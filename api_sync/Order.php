<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/helpers/jwt_helper.php';

$database = new Database();
$db = $database->getConnection();

if (!$db) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Database connection failed"]);
    exit();
}

function getBearerToken() {
    $headers = [];
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        if (!is_array($headers)) {
            $headers = [];
        }
    }

    $authHeader = '';
    if (isset($headers['Authorization'])) {
        $authHeader = $headers['Authorization'];
    } elseif (isset($headers['authorization'])) {
        $authHeader = $headers['authorization'];
    } elseif (function_exists('apache_request_headers')) {
        $apacheHeaders = apache_request_headers();
        if (isset($apacheHeaders['Authorization'])) {
            $authHeader = $apacheHeaders['Authorization'];
        } elseif (isset($apacheHeaders['authorization'])) {
            $authHeader = $apacheHeaders['authorization'];
        }
    }

    if ($authHeader === '' && isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
    }

    if ($authHeader === '' && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }

    if ($authHeader && preg_match('/Bearer\\s(\\S+)/', $authHeader, $matches)) {
        return $matches[1];
    }

    return null;
}

$token = getBearerToken();

if (empty($token)) {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "No token provided"]);
    exit();
}
$decoded = JWT::decode($token);

if (!$decoded) {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Invalid or expired token"]);
    exit();
}

$user_id = $decoded['user_id'];
$method = $_SERVER['REQUEST_METHOD'];

function normalizePaymentStatus($status) {
    if ($status === null || $status === '') {
        return 'pending';
    }

    $status = strtolower(trim($status));

    if ($status === 'partial' || $status === 'partially paid' || $status === 'partially_paid') {
        return 'partially_paid';
    }

    $allowed = ['pending', 'partially_paid', 'paid', 'refunded'];
    return in_array($status, $allowed, true) ? $status : 'pending';
}

function normalizeDateOrNull($value) {
    if ($value === null) {
        return null;
    }

    $trimmed = trim((string)$value);
    if ($trimmed === '' || $trimmed === '0000-00-00') {
        return null;
    }

    return $trimmed;
}

function normalizeRating($value) {
    if ($value === null || $value === '') {
        return null;
    }

    $rating = (int)$value;
    if ($rating < 1 || $rating > 5) {
        return null;
    }

    return $rating;
}

function fetchTableColumns($db, $table) {
    static $cache = [];

    if (isset($cache[$table])) {
        return $cache[$table];
    }

    $columns = [];

    try {
        $stmt = $db->prepare("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table");
        $stmt->bindValue(':table', $table);
        $stmt->execute();

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            if (!empty($row['COLUMN_NAME'])) {
                $columns[$row['COLUMN_NAME']] = true;
            }
        }
    } catch (Exception $e) {
        $columns = [];
    }

    $cache[$table] = $columns;
    return $columns;
}

function fetchOrderPaidTotal($db, $order_id) {
    $query = "SELECT COALESCE(SUM(amount), 0) as total_paid
              FROM payments
              WHERE order_id = :order_id
              AND payment_status IN ('completed', 'paid')";

    $stmt = $db->prepare($query);
    $stmt->bindParam(':order_id', $order_id);
    $stmt->execute();
    $result = $stmt->fetch(PDO::FETCH_ASSOC);

    return (float)($result['total_paid'] ?? 0);
}

function normalizeIdList($value) {
    if ($value === null) {
        return [];
    }

    $list = [];

    if (is_array($value)) {
        $list = $value;
    } elseif (is_string($value)) {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return [];
        }
        $decoded = json_decode($trimmed, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            $list = $decoded;
        } else {
            $list = explode(',', $trimmed);
        }
    } else {
        $list = [$value];
    }

    $ids = [];
    foreach ($list as $entry) {
        $id = (int)$entry;
        if ($id > 0) {
            $ids[] = $id;
        }
    }

    return array_values(array_unique($ids));
}

function fetchProductNamesByIds($db, $ids) {
    $ids = array_values(array_unique(array_filter(array_map('intval', $ids), function ($id) {
        return $id > 0;
    })));

    if (empty($ids)) {
        return [];
    }

    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $db->prepare("SELECT id, product_name FROM products WHERE id IN ($placeholders)");
    $stmt->execute($ids);

    $map = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $map[(int)$row['id']] = $row['product_name'];
    }

    return $map;
}

function buildNamesFromIds($ids, $nameMap) {
    $names = [];
    foreach ($ids as $id) {
        if (isset($nameMap[$id])) {
            $names[] = $nameMap[$id];
        }
    }
    return $names;
}

function createPayment($db, $order_id, $order_code, $amount, $payment_type, $staff_id, $notes = '', $payment_method = 'cash', $payment_status = 'completed', $meta = []) {
    if ((float)$amount <= 0) {
        return true;
    }

    $payment_code = 'PAY-' . $order_code . '-' . strtoupper($payment_type) . '-' . time();
    $paymentColumns = fetchTableColumns($db, 'payments');
    $hasSchemaInfo = !empty($paymentColumns);

    $data = [
        'payment_code' => $payment_code,
        'order_id' => $order_id,
        'amount' => $amount,
        'payment_method' => $payment_method,
        'payment_status' => $payment_status,
        'notes' => $notes,
        'created_by' => $staff_id
    ];

    $optional = ['estimated_cost', 'final_cost', 'deposit_amount', 'transaction_id'];
    foreach ($optional as $key) {
        if (array_key_exists($key, $meta)) {
            $data[$key] = $meta[$key];
        }
    }

    $columns = [];
    $placeholders = [];
    $params = [];

    foreach ($data as $column => $value) {
        if ($hasSchemaInfo && !isset($paymentColumns[$column])) {
            continue;
        }
        $columns[] = $column;
        $placeholders[] = ':' . $column;
        $params[':' . $column] = $value;
    }

    if ($hasSchemaInfo) {
        if (isset($paymentColumns['created_at'])) {
            $columns[] = 'created_at';
            $placeholders[] = 'NOW()';
        }
        if (isset($paymentColumns['updated_at'])) {
            $columns[] = 'updated_at';
            $placeholders[] = 'NOW()';
        }
    } else {
        $columns[] = 'created_at';
        $placeholders[] = 'NOW()';
        $columns[] = 'updated_at';
        $placeholders[] = 'NOW()';
    }

    if (empty($columns)) {
        return false;
    }

    $query = "INSERT INTO payments (" . implode(', ', $columns) . ") VALUES (" . implode(', ', $placeholders) . ")";
    $stmt = $db->prepare($query);

    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }

    return $stmt->execute();
}

function updateOrderPaymentStatus($db, $order_id, $final_cost, $current_status = null) {
    if ($current_status === null) {
        $statusStmt = $db->prepare("SELECT payment_status FROM service_orders WHERE id = :order_id");
        $statusStmt->bindParam(':order_id', $order_id);
        $statusStmt->execute();
        $statusRow = $statusStmt->fetch(PDO::FETCH_ASSOC);
        $current_status = $statusRow ? $statusRow['payment_status'] : null;
    }

    $current_status = $current_status ? normalizePaymentStatus($current_status) : null;

    if ($current_status === 'refunded') {
        $payment_status = 'refunded';
    } elseif ((float)$final_cost <= 0) {
        $payment_status = 'paid';
    } else {
        $total_paid = fetchOrderPaidTotal($db, $order_id);

        if ($total_paid >= (float)$final_cost) {
            $payment_status = 'paid';
        } elseif ($total_paid > 0 && $total_paid < (float)$final_cost) {
            $payment_status = 'partially_paid';
        } else {
            $payment_status = 'pending';
        }
    }

    $updateQuery = "UPDATE service_orders
                    SET payment_status = :payment_status,
                        updated_at = NOW()
                    WHERE id = :order_id";

    $updateStmt = $db->prepare($updateQuery);
    $updateStmt->bindParam(':payment_status', $payment_status);
    $updateStmt->bindParam(':order_id', $order_id);

    return $updateStmt->execute();
}

function ensureOrderPayments($db, $order_id, $order_code, $final_cost, $deposit_amount, $desired_status, $staff_id, $payment_method, $notes, $meta = []) {
    $desired_status = normalizePaymentStatus($desired_status);

    if ($desired_status === 'pending' || $desired_status === 'refunded') {
        return;
    }

    $final_cost = (float)$final_cost;
    $deposit_amount = (float)$deposit_amount;

    if ($final_cost <= 0) {
        return;
    }

    $total_paid = fetchOrderPaidTotal($db, $order_id);

    if ($desired_status === 'paid') {
        $remaining = $final_cost - $total_paid;
        if ($remaining > 0) {
            createPayment($db, $order_id, $order_code, $remaining, 'FINAL', $staff_id, $notes, $payment_method, 'completed', $meta);
        }
        return;
    }

    if ($desired_status === 'partially_paid') {
        $target = min(max($deposit_amount, 0), $final_cost);
        $missing = $target - $total_paid;
        if ($missing > 0) {
            createPayment($db, $order_id, $order_code, $missing, 'DEPOSIT', $staff_id, $notes, $payment_method, 'completed', $meta);
        }
    }
}

function syncOrderProducts($db, $order_id, $product_ids, $is_replacement) {
    $deleteStmt = $db->prepare("DELETE FROM service_order_products WHERE order_id = :order_id AND is_replacement = :is_replacement");
    $deleteStmt->bindValue(':order_id', $order_id, PDO::PARAM_INT);
    $deleteStmt->bindValue(':is_replacement', $is_replacement ? 1 : 0, PDO::PARAM_INT);
    $deleteStmt->execute();

    if (empty($product_ids)) {
        return;
    }

    $insertStmt = $db->prepare("INSERT INTO service_order_products (order_id, product_id, is_replacement, sort_order, created_at)
                                VALUES (:order_id, :product_id, :is_replacement, :sort_order, NOW())");

    foreach ($product_ids as $index => $product_id) {
        $insertStmt->bindValue(':order_id', $order_id, PDO::PARAM_INT);
        $insertStmt->bindValue(':product_id', (int)$product_id, PDO::PARAM_INT);
        $insertStmt->bindValue(':is_replacement', $is_replacement ? 1 : 0, PDO::PARAM_INT);
        $insertStmt->bindValue(':sort_order', (int)$index, PDO::PARAM_INT);
        $insertStmt->execute();
    }
}

function fetchOrderProductsMap($db, $order_ids) {
    $map = [];

    if (empty($order_ids)) {
        return $map;
    }

    $placeholders = implode(',', array_fill(0, count($order_ids), '?'));
    $query = "SELECT sop.order_id,
                     sop.is_replacement,
                     GROUP_CONCAT(sop.product_id ORDER BY sop.sort_order SEPARATOR ',') AS product_ids,
                     GROUP_CONCAT(p.product_name ORDER BY sop.sort_order SEPARATOR '||') AS product_names
              FROM service_order_products sop
              JOIN products p ON sop.product_id = p.id
              WHERE sop.order_id IN ($placeholders)
              GROUP BY sop.order_id, sop.is_replacement";

    $stmt = $db->prepare($query);
    $stmt->execute($order_ids);

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $order_id = (int)$row['order_id'];
        $bucket = ((int)$row['is_replacement'] === 1) ? 'replacement' : 'primary';
        $ids = $row['product_ids'] !== null && $row['product_ids'] !== ''
            ? array_map('intval', explode(',', $row['product_ids']))
            : [];
        $names = $row['product_names'] !== null && $row['product_names'] !== ''
            ? explode('||', $row['product_names'])
            : [];
        $map[$order_id][$bucket] = [
            'ids' => $ids,
            'names' => $names
        ];
    }

    return $map;
}

function getOrderWithRelations($db, $order_id) {
    $query = "SELECT so.*,
                     c.full_name as client_name,
                     c.email as client_email,
                     c.phone as client_phone,
                     c.address as client_address,
                     p.product_name,
                     p.brand as product_brand,
                     p.model as product_model,
                     p.specifications as product_specifications,
                     p.serial_number,
                     rp.product_name as replacement_product_name,
                     rp.brand as replacement_product_brand,
                     rp.model as replacement_product_model,
                     rp.serial_number as replacement_serial_number,
                     u.name as staff_name,
                     u.email as staff_email
              FROM service_orders so
              LEFT JOIN clients c ON so.client_id = c.id
              LEFT JOIN products p ON so.product_id = p.id
              LEFT JOIN products rp ON so.replacement_product_id = rp.id
              LEFT JOIN users u ON so.staff_id = u.id
              WHERE so.id = :id";

    $stmt = $db->prepare($query);
    $stmt->bindParam(':id', $order_id);
    $stmt->execute();
    $order = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$order) {
        return null;
    }

    $stored_primary_ids = array_key_exists('product_ids', $order) ? normalizeIdList($order['product_ids']) : [];
    $stored_replacement_ids = array_key_exists('replacement_product_ids', $order) ? normalizeIdList($order['replacement_product_ids']) : [];
    $stored_names_map = [];

    if (!empty($stored_primary_ids) || !empty($stored_replacement_ids)) {
        $stored_names_map = fetchProductNamesByIds($db, array_merge($stored_primary_ids, $stored_replacement_ids));
    }

    $needs_map = empty($stored_primary_ids) || empty($stored_replacement_ids);
    $map = $needs_map ? fetchOrderProductsMap($db, [(int)$order_id]) : [];
    $primary = $map[$order_id]['primary'] ?? null;
    $replacement = $map[$order_id]['replacement'] ?? null;

    if (!empty($stored_primary_ids)) {
        $order['product_ids'] = $stored_primary_ids;
        $order['product_names'] = buildNamesFromIds($stored_primary_ids, $stored_names_map);
    } elseif ($primary) {
        $order['product_ids'] = $primary['ids'];
        $order['product_names'] = $primary['names'];
    } else {
        $primary_id = isset($order['product_id']) ? (int)$order['product_id'] : 0;
        $order['product_ids'] = $primary_id > 0 ? [$primary_id] : [];
        $order['product_names'] = !empty($order['product_name']) ? [$order['product_name']] : [];
    }

    if (!empty($stored_replacement_ids)) {
        $order['replacement_product_ids'] = $stored_replacement_ids;
        $order['replacement_product_names'] = buildNamesFromIds($stored_replacement_ids, $stored_names_map);
    } elseif ($replacement) {
        $order['replacement_product_ids'] = $replacement['ids'];
        $order['replacement_product_names'] = $replacement['names'];
    } else {
        $replacement_id = isset($order['replacement_product_id']) ? (int)$order['replacement_product_id'] : 0;
        $order['replacement_product_ids'] = $replacement_id > 0 ? [$replacement_id] : [];
        $order['replacement_product_names'] = !empty($order['replacement_product_name']) ? [$order['replacement_product_name']] : [];
    }

    return $order;
}

try {
    switch ($method) {
        case 'GET':
            $id = isset($_GET['id']) ? $_GET['id'] : null;
            $search = isset($_GET['search']) ? trim($_GET['search']) : '';
            $status = isset($_GET['status']) ? trim($_GET['status']) : '';
            $priority = isset($_GET['priority']) ? trim($_GET['priority']) : '';
            $start_date = isset($_GET['start_date']) ? trim($_GET['start_date']) : '';
            $end_date = isset($_GET['end_date']) ? trim($_GET['end_date']) : '';

            if ($id) {
                $order = getOrderWithRelations($db, $id);

                if (!$order) {
                    http_response_code(404);
                    echo json_encode(["success" => false, "message" => "Order not found"]);
                    exit();
                }

                $paymentsQuery = "SELECT *
                                  FROM payments
                                  WHERE order_id = :order_id
                                  ORDER BY created_at ASC";
                $paymentsStmt = $db->prepare($paymentsQuery);
                $paymentsStmt->bindParam(':order_id', $id);
                $paymentsStmt->execute();
                $payments = $paymentsStmt->fetchAll(PDO::FETCH_ASSOC);

                $total_paid = 0;
                foreach ($payments as $payment) {
                    if (in_array($payment['payment_status'], ['completed', 'paid'], true)) {
                        $total_paid += (float)$payment['amount'];
                    }
                }

                $final_cost = (float)($order['final_cost'] ?: 0);
                $balance = $final_cost - $total_paid;

                echo json_encode([
                    "success" => true,
                    "order" => $order,
                    "payments" => $payments,
                    "payment_summary" => [
                        "total_paid" => $total_paid,
                        "final_cost" => $final_cost,
                        "deposit_amount" => (float)($order['deposit_amount'] ?: 0),
                        "balance" => $balance
                    ]
                ]);
                exit();
            }

            $query = "SELECT so.*,
                             c.full_name as client_name,
                             c.phone as client_phone,
                             p.product_name,
                             p.brand as product_brand,
                             p.model as product_model,
                             p.serial_number,
                             rp.product_name as replacement_product_name,
                             u.name as staff_name,
                             u.email as staff_email
                      FROM service_orders so
                      LEFT JOIN clients c ON so.client_id = c.id
                      LEFT JOIN products p ON so.product_id = p.id
                      LEFT JOIN products rp ON so.replacement_product_id = rp.id
                      LEFT JOIN users u ON so.staff_id = u.id
                      WHERE 1=1";

            $params = [];

            if ($search !== '') {
                $query .= " AND (
                    so.order_code LIKE :search OR
                    c.full_name LIKE :search OR
                    c.phone LIKE :search OR
                    p.product_name LIKE :search OR
                    rp.product_name LIKE :search OR
                    p.serial_number LIKE :search OR
                    p.product_code LIKE :search OR
                    u.name LIKE :search
                )";
                $params[':search'] = "%{$search}%";
            }

            if ($status !== '' && $status !== 'all') {
                $query .= " AND so.status = :status";
                $params[':status'] = $status;
            }

            if ($priority !== '' && $priority !== 'all') {
                $query .= " AND so.priority = :priority";
                $params[':priority'] = $priority;
            }

            if ($start_date !== '' && $end_date !== '') {
                $query .= " AND DATE(so.created_at) BETWEEN :start_date AND :end_date";
                $params[':start_date'] = $start_date;
                $params[':end_date'] = $end_date;
            }

            $query .= " ORDER BY so.created_at DESC";

            $stmt = $db->prepare($query);
            $stmt->execute($params);
            $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if (!empty($orders)) {
                $orderIds = array_map('intval', array_column($orders, 'id'));
                $productMap = fetchOrderProductsMap($db, $orderIds);

                $stored_primary_by_order = [];
                $stored_replacement_by_order = [];
                $stored_ids = [];

                foreach ($orders as $order) {
                    $orderId = (int)$order['id'];

                    if (array_key_exists('product_ids', $order)) {
                        $ids = normalizeIdList($order['product_ids']);
                        if (!empty($ids)) {
                            $stored_primary_by_order[$orderId] = $ids;
                            $stored_ids = array_merge($stored_ids, $ids);
                        }
                    }

                    if (array_key_exists('replacement_product_ids', $order)) {
                        $ids = normalizeIdList($order['replacement_product_ids']);
                        if (!empty($ids)) {
                            $stored_replacement_by_order[$orderId] = $ids;
                            $stored_ids = array_merge($stored_ids, $ids);
                        }
                    }
                }

                $stored_names_map = !empty($stored_ids) ? fetchProductNamesByIds($db, $stored_ids) : [];

                foreach ($orders as &$order) {
                    $orderId = (int)$order['id'];
                    $primary = $productMap[$orderId]['primary'] ?? null;
                    $replacement = $productMap[$orderId]['replacement'] ?? null;
                    $primary_json = $stored_primary_by_order[$orderId] ?? [];
                    $replacement_json = $stored_replacement_by_order[$orderId] ?? [];

                    if (!empty($primary_json)) {
                        $order['product_ids'] = $primary_json;
                        $order['product_names'] = buildNamesFromIds($primary_json, $stored_names_map);
                    } elseif ($primary) {
                        $order['product_ids'] = $primary['ids'];
                        $order['product_names'] = $primary['names'];
                    } else {
                        $primary_id = isset($order['product_id']) ? (int)$order['product_id'] : 0;
                        $order['product_ids'] = $primary_id > 0 ? [$primary_id] : [];
                        $order['product_names'] = !empty($order['product_name']) ? [$order['product_name']] : [];
                    }

                    if (!empty($replacement_json)) {
                        $order['replacement_product_ids'] = $replacement_json;
                        $order['replacement_product_names'] = buildNamesFromIds($replacement_json, $stored_names_map);
                    } elseif ($replacement) {
                        $order['replacement_product_ids'] = $replacement['ids'];
                        $order['replacement_product_names'] = $replacement['names'];
                    } else {
                        $replacement_id = isset($order['replacement_product_id']) ? (int)$order['replacement_product_id'] : 0;
                        $order['replacement_product_ids'] = $replacement_id > 0 ? [$replacement_id] : [];
                        $order['replacement_product_names'] = !empty($order['replacement_product_name']) ? [$order['replacement_product_name']] : [];
                    }
                }
                unset($order);
            }

            echo json_encode([
                "success" => true,
                "orders" => $orders,
                "count" => count($orders)
            ]);
            break;

        case 'POST':
            $input = json_decode(file_get_contents("php://input"), true);

            if (!$input) {
                http_response_code(400);
                echo json_encode(["success" => false, "message" => "Invalid input"]);
                exit();
            }

            $required_fields = ['client_id'];
            foreach ($required_fields as $field) {
                if (!isset($input[$field]) || $input[$field] === '' || $input[$field] === null) {
                    http_response_code(400);
                    echo json_encode(["success" => false, "message" => "Missing required field: {$field}"]);
                    exit();
                }
            }

            $product_ids = normalizeIdList($input['product_ids'] ?? ($input['product_id'] ?? null));
            if (empty($product_ids)) {
                http_response_code(400);
                echo json_encode(["success" => false, "message" => "Missing required field: product_ids"]);
                exit();
            }
            $replacement_product_ids = normalizeIdList($input['replacement_product_ids'] ?? ($input['replacement_product_id'] ?? null));
            $product_ids_json = json_encode($product_ids);
            $replacement_product_ids_json = !empty($replacement_product_ids) ? json_encode($replacement_product_ids) : null;

            $db->beginTransaction();

            try {
                $order_code = 'ORD' . date('Ymd') . strtoupper(substr(uniqid(), 7, 6));

                $staff_id = isset($input['staff_id']) && $input['staff_id'] !== '' ? (int)$input['staff_id'] : null;
                $primary_product_id = $product_ids[0];
                $primary_replacement_product_id = !empty($replacement_product_ids) ? (int)$replacement_product_ids[0] : null;
                $issue_description = isset($input['issue_description']) ? trim($input['issue_description']) : '';
                $estimated_cost = isset($input['estimated_cost']) && $input['estimated_cost'] !== '' ? (float)$input['estimated_cost'] : 0.00;
                $final_cost = isset($input['final_cost']) && $input['final_cost'] !== '' ? (float)$input['final_cost'] : $estimated_cost;
                $deposit_amount = isset($input['deposit_amount']) && $input['deposit_amount'] !== '' ? (float)$input['deposit_amount'] : 0.00;
                $service_type = isset($input['service_type']) && trim((string)$input['service_type']) !== '' ? trim((string)$input['service_type']) : 'general';
                $diagnosis_notes = isset($input['diagnosis_notes']) ? trim((string)$input['diagnosis_notes']) : null;
                $repair_notes = isset($input['repair_notes']) ? trim((string)$input['repair_notes']) : null;
                $actual_delivery_date = normalizeDateOrNull($input['actual_delivery_date'] ?? null);
                $rating = normalizeRating($input['rating'] ?? null);

                $warranty_status = isset($input['warranty_status']) ? $input['warranty_status'] : 'out_of_warranty';
                $payment_status = normalizePaymentStatus(isset($input['payment_status']) ? $input['payment_status'] : 'pending');
                $status = isset($input['status']) ? $input['status'] : 'pending';
                $priority = isset($input['priority']) ? $input['priority'] : 'medium';
                $estimated_delivery_date = normalizeDateOrNull($input['estimated_delivery_date'] ?? null);
                $notes = isset($input['notes']) ? $input['notes'] : '';

                $payment_method = isset($input['payment_method']) && trim((string)$input['payment_method']) !== ''
                    ? trim((string)$input['payment_method'])
                    : 'cash';
                $transaction_id = isset($input['transaction_id']) && trim((string)$input['transaction_id']) !== ''
                    ? trim((string)$input['transaction_id'])
                    : null;
                $payment_notes = isset($input['payment_notes']) ? trim((string)$input['payment_notes']) : '';

                $orderColumns = fetchTableColumns($db, 'service_orders');
                $hasOrderColumns = !empty($orderColumns);

                $orderAssignments = [
                    'order_code = :order_code',
                    'client_id = :client_id',
                    'product_id = :product_id',
                    'product_ids = :product_ids',
                    'replacement_product_id = :replacement_product_id',
                    'replacement_product_ids = :replacement_product_ids',
                    'staff_id = :staff_id',
                    'issue_description = :issue_description',
                    'warranty_status = :warranty_status',
                    'estimated_cost = :estimated_cost',
                    'final_cost = :final_cost',
                    'deposit_amount = :deposit_amount',
                    'payment_status = :payment_status',
                    'estimated_delivery_date = :estimated_delivery_date',
                    'status = :status',
                    'priority = :priority',
                    'notes = :notes',
                    'created_at = NOW()',
                    'updated_at = NOW()'
                ];

                if ($hasOrderColumns && isset($orderColumns['service_type'])) {
                    $orderAssignments[] = 'service_type = :service_type';
                }
                if ($hasOrderColumns && isset($orderColumns['diagnosis_notes'])) {
                    $orderAssignments[] = 'diagnosis_notes = :diagnosis_notes';
                }
                if ($hasOrderColumns && isset($orderColumns['repair_notes'])) {
                    $orderAssignments[] = 'repair_notes = :repair_notes';
                }
                if ($hasOrderColumns && isset($orderColumns['actual_delivery_date'])) {
                    $orderAssignments[] = 'actual_delivery_date = :actual_delivery_date';
                }
                if ($hasOrderColumns && isset($orderColumns['rating'])) {
                    $orderAssignments[] = 'rating = :rating';
                }

                $query = "INSERT INTO service_orders SET " . implode(', ', $orderAssignments);

                $stmt = $db->prepare($query);
                $stmt->bindParam(':order_code', $order_code);
                $stmt->bindParam(':client_id', $input['client_id']);
                $stmt->bindValue(':product_id', $primary_product_id, PDO::PARAM_INT);
                $stmt->bindValue(':product_ids', $product_ids_json, PDO::PARAM_STR);
                $stmt->bindValue(':replacement_product_id', $primary_replacement_product_id, is_null($primary_replacement_product_id) ? PDO::PARAM_NULL : PDO::PARAM_INT);
                $stmt->bindValue(':replacement_product_ids', $replacement_product_ids_json, is_null($replacement_product_ids_json) ? PDO::PARAM_NULL : PDO::PARAM_STR);
                $stmt->bindValue(':staff_id', $staff_id, is_null($staff_id) ? PDO::PARAM_NULL : PDO::PARAM_INT);
                if ($hasOrderColumns && isset($orderColumns['service_type'])) {
                    $stmt->bindParam(':service_type', $service_type);
                }
                $stmt->bindParam(':issue_description', $issue_description);
                $stmt->bindParam(':warranty_status', $warranty_status);
                $stmt->bindParam(':estimated_cost', $estimated_cost);
                $stmt->bindParam(':final_cost', $final_cost);
                $stmt->bindParam(':deposit_amount', $deposit_amount);
                $stmt->bindParam(':payment_status', $payment_status);
                $stmt->bindValue(':estimated_delivery_date', $estimated_delivery_date, is_null($estimated_delivery_date) ? PDO::PARAM_NULL : PDO::PARAM_STR);
                $stmt->bindParam(':status', $status);
                $stmt->bindParam(':priority', $priority);
                $stmt->bindParam(':notes', $notes);
                if ($hasOrderColumns && isset($orderColumns['diagnosis_notes'])) {
                    $stmt->bindValue(':diagnosis_notes', $diagnosis_notes, $diagnosis_notes === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
                }
                if ($hasOrderColumns && isset($orderColumns['repair_notes'])) {
                    $stmt->bindValue(':repair_notes', $repair_notes, $repair_notes === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
                }
                if ($hasOrderColumns && isset($orderColumns['actual_delivery_date'])) {
                    $stmt->bindValue(':actual_delivery_date', $actual_delivery_date, $actual_delivery_date === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
                }
                if ($hasOrderColumns && isset($orderColumns['rating'])) {
                    $stmt->bindValue(':rating', $rating, $rating === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
                }

                if (!$stmt->execute()) {
                    throw new Exception("Failed to create order");
                }

                $order_id = $db->lastInsertId();

                syncOrderProducts($db, $order_id, $product_ids, false);
                syncOrderProducts($db, $order_id, $replacement_product_ids, true);

                $paymentMeta = [
                    'estimated_cost' => $estimated_cost,
                    'final_cost' => $final_cost,
                    'deposit_amount' => $deposit_amount
                ];
                if ($transaction_id !== null) {
                    $paymentMeta['transaction_id'] = $transaction_id;
                }

                if ($deposit_amount > 0) {
                    $depositNote = $payment_notes !== '' ? $payment_notes : 'Initial deposit for service order';
                    if (!createPayment($db, $order_id, $order_code, $deposit_amount, 'DEPOSIT', $user_id, $depositNote, $payment_method, 'completed', $paymentMeta)) {
                        throw new Exception("Failed to create deposit payment");
                    }
                }

                if ($payment_status === 'paid' && $final_cost > $deposit_amount) {
                    $remaining_amount = $final_cost - $deposit_amount;
                    if ($remaining_amount > 0) {
                        $finalNote = $payment_notes !== '' ? $payment_notes : 'Final payment for service order';
                        if (!createPayment($db, $order_id, $order_code, $remaining_amount, 'FINAL', $user_id, $finalNote, $payment_method, 'completed', $paymentMeta)) {
                            throw new Exception("Failed to create final payment");
                        }
                    }
                }

                updateOrderPaymentStatus($db, $order_id, $final_cost, $payment_status);

                $order = getOrderWithRelations($db, $order_id);

                $paymentsStmt = $db->prepare("SELECT * FROM payments WHERE order_id = :order_id ORDER BY created_at ASC");
                $paymentsStmt->bindParam(':order_id', $order_id);
                $paymentsStmt->execute();
                $payments = $paymentsStmt->fetchAll(PDO::FETCH_ASSOC);

                $total_paid = 0;
                foreach ($payments as $payment) {
                    if (in_array($payment['payment_status'], ['completed', 'paid'], true)) {
                        $total_paid += (float)$payment['amount'];
                    }
                }

                $db->commit();

                echo json_encode([
                    "success" => true,
                    "message" => "Order created successfully",
                    "order_id" => $order_id,
                    "order_code" => $order_code,
                    "order" => $order,
                    "payments" => $payments,
                    "payment_summary" => [
                        "total_paid" => $total_paid,
                        "final_cost" => $final_cost,
                        "deposit_amount" => $deposit_amount,
                        "balance" => $final_cost - $total_paid
                    ]
                ]);
            } catch (Exception $e) {
                $db->rollBack();
                http_response_code(500);
                echo json_encode([
                    "success" => false,
                    "message" => "Failed to create order",
                    "error" => $e->getMessage()
                ]);
            }
            break;

        case 'PUT':
            $id = isset($_GET['id']) ? $_GET['id'] : null;

            if (!$id) {
                http_response_code(400);
                echo json_encode(["success" => false, "message" => "Order ID required"]);
                exit();
            }

            $input = json_decode(file_get_contents("php://input"), true);

            if (!$input) {
                http_response_code(400);
                echo json_encode(["success" => false, "message" => "Invalid input"]);
                exit();
            }

            $fields = [];
            $params = [':id' => $id];
            $update_product_ids = null;
            $update_replacement_product_ids = null;
            $orderColumns = fetchTableColumns($db, 'service_orders');
            $hasOrderColumns = !empty($orderColumns);

            if (isset($input['client_id']) && $input['client_id'] !== '') {
                $fields[] = 'client_id = :client_id';
                $params[':client_id'] = $input['client_id'];
            }

            if (array_key_exists('product_ids', $input) || array_key_exists('product_id', $input)) {
                $product_ids = normalizeIdList($input['product_ids'] ?? ($input['product_id'] ?? null));
                if (empty($product_ids)) {
                    http_response_code(400);
                    echo json_encode(["success" => false, "message" => "At least one product is required"]);
                    exit();
                }
                $fields[] = 'product_id = :product_id';
                $fields[] = 'product_ids = :product_ids';
                $params[':product_id'] = $product_ids[0];
                $params[':product_ids'] = json_encode($product_ids);
                $update_product_ids = $product_ids;
            }

            if (array_key_exists('replacement_product_ids', $input) || array_key_exists('replacement_product_id', $input)) {
                $replacement_product_ids = normalizeIdList($input['replacement_product_ids'] ?? ($input['replacement_product_id'] ?? null));
                $fields[] = 'replacement_product_id = :replacement_product_id';
                $fields[] = 'replacement_product_ids = :replacement_product_ids';
                $params[':replacement_product_id'] = !empty($replacement_product_ids) ? $replacement_product_ids[0] : null;
                $params[':replacement_product_ids'] = !empty($replacement_product_ids) ? json_encode($replacement_product_ids) : null;
                $update_replacement_product_ids = $replacement_product_ids;
            }

            if (array_key_exists('staff_id', $input)) {
                $fields[] = 'staff_id = :staff_id';
                $params[':staff_id'] = ($input['staff_id'] === '' || $input['staff_id'] === null) ? null : $input['staff_id'];
            }

            if ($hasOrderColumns && isset($orderColumns['service_type']) && isset($input['service_type'])) {
                $fields[] = 'service_type = :service_type';
                $params[':service_type'] = trim((string)$input['service_type']) !== '' ? trim((string)$input['service_type']) : 'general';
            }

            if (isset($input['issue_description'])) {
                $fields[] = 'issue_description = :issue_description';
                $params[':issue_description'] = $input['issue_description'];
            }

            if ($hasOrderColumns && isset($orderColumns['diagnosis_notes']) && array_key_exists('diagnosis_notes', $input)) {
                $fields[] = 'diagnosis_notes = :diagnosis_notes';
                $params[':diagnosis_notes'] = trim((string)$input['diagnosis_notes']);
            }

            if ($hasOrderColumns && isset($orderColumns['repair_notes']) && array_key_exists('repair_notes', $input)) {
                $fields[] = 'repair_notes = :repair_notes';
                $params[':repair_notes'] = trim((string)$input['repair_notes']);
            }

            if (isset($input['warranty_status'])) {
                $fields[] = 'warranty_status = :warranty_status';
                $params[':warranty_status'] = $input['warranty_status'];
            }

            if (array_key_exists('estimated_cost', $input)) {
                $fields[] = 'estimated_cost = :estimated_cost';
                $params[':estimated_cost'] = ($input['estimated_cost'] === '' || $input['estimated_cost'] === null) ? 0 : $input['estimated_cost'];
            }

            if (isset($input['final_cost']) && $input['final_cost'] !== '') {
                $fields[] = 'final_cost = :final_cost';
                $params[':final_cost'] = $input['final_cost'];
            }

            if (isset($input['deposit_amount']) && $input['deposit_amount'] !== '') {
                $fields[] = 'deposit_amount = :deposit_amount';
                $params[':deposit_amount'] = $input['deposit_amount'];
            }

            if (isset($input['payment_status'])) {
                $fields[] = 'payment_status = :payment_status';
                $params[':payment_status'] = normalizePaymentStatus($input['payment_status']);
            }

            if (array_key_exists('estimated_delivery_date', $input)) {
                $fields[] = 'estimated_delivery_date = :estimated_delivery_date';
                $params[':estimated_delivery_date'] = normalizeDateOrNull($input['estimated_delivery_date']);
            }

            if ($hasOrderColumns && isset($orderColumns['actual_delivery_date']) && array_key_exists('actual_delivery_date', $input)) {
                $fields[] = 'actual_delivery_date = :actual_delivery_date';
                $params[':actual_delivery_date'] = normalizeDateOrNull($input['actual_delivery_date']);
            }

            if ($hasOrderColumns && isset($orderColumns['rating']) && array_key_exists('rating', $input)) {
                $fields[] = 'rating = :rating';
                $params[':rating'] = normalizeRating($input['rating']);
            }

            if (isset($input['status'])) {
                $fields[] = 'status = :status';
                $params[':status'] = $input['status'];
            }

            if (isset($input['priority'])) {
                $fields[] = 'priority = :priority';
                $params[':priority'] = $input['priority'];
            }

            if (isset($input['notes'])) {
                $fields[] = 'notes = :notes';
                $params[':notes'] = $input['notes'];
            }

            $fields[] = 'updated_at = NOW()';

            if (empty($fields)) {
                http_response_code(400);
                echo json_encode(["success" => false, "message" => "No fields to update"]);
                exit();
            }

            $query = "UPDATE service_orders SET " . implode(', ', $fields) . " WHERE id = :id";
            $stmt = $db->prepare($query);
            $db->beginTransaction();

            try {
                if (!$stmt->execute($params)) {
                    throw new Exception("Failed to update order");
                }

                if (!is_null($update_product_ids)) {
                    syncOrderProducts($db, (int)$id, $update_product_ids, false);
                }

                if (!is_null($update_replacement_product_ids)) {
                    syncOrderProducts($db, (int)$id, $update_replacement_product_ids, true);
                }

                $summaryStmt = $db->prepare("SELECT order_code, final_cost, deposit_amount, payment_status, estimated_cost FROM service_orders WHERE id = :id");
                $summaryStmt->bindValue(':id', $id, PDO::PARAM_INT);
                $summaryStmt->execute();
                $orderSummary = $summaryStmt->fetch(PDO::FETCH_ASSOC);

                if ($orderSummary) {
                    $desiredStatus = isset($input['payment_status'])
                        ? normalizePaymentStatus($input['payment_status'])
                        : normalizePaymentStatus($orderSummary['payment_status'] ?? 'pending');
                    $payment_method = isset($input['payment_method']) && trim((string)$input['payment_method']) !== ''
                        ? trim((string)$input['payment_method'])
                        : 'cash';
                    $transaction_id = isset($input['transaction_id']) && trim((string)$input['transaction_id']) !== ''
                        ? trim((string)$input['transaction_id'])
                        : null;
                    $payment_notes = isset($input['payment_notes']) && trim((string)$input['payment_notes']) !== ''
                        ? trim((string)$input['payment_notes'])
                        : 'Payment update for service order';

                    $paymentMeta = [
                        'estimated_cost' => (float)($orderSummary['estimated_cost'] ?? 0),
                        'final_cost' => (float)($orderSummary['final_cost'] ?? 0),
                        'deposit_amount' => (float)($orderSummary['deposit_amount'] ?? 0)
                    ];
                    if ($transaction_id !== null) {
                        $paymentMeta['transaction_id'] = $transaction_id;
                    }

                    ensureOrderPayments(
                        $db,
                        (int)$id,
                        $orderSummary['order_code'],
                        (float)($orderSummary['final_cost'] ?? 0),
                        (float)($orderSummary['deposit_amount'] ?? 0),
                        $desiredStatus,
                        $user_id,
                        $payment_method,
                        $payment_notes,
                        $paymentMeta
                    );
                }

                $db->commit();
            } catch (Exception $e) {
                $db->rollBack();
                http_response_code(500);
                echo json_encode(["success" => false, "message" => $e->getMessage()]);
                exit();
            }

            $order = getOrderWithRelations($db, $id);
            if ($order) {
                $currentStatus = isset($input['payment_status'])
                    ? normalizePaymentStatus($input['payment_status'])
                    : normalizePaymentStatus($order['payment_status'] ?? 'pending');
                updateOrderPaymentStatus($db, $id, (float)($order['final_cost'] ?: 0), $currentStatus);
            }

            echo json_encode([
                "success" => true,
                "message" => "Order updated successfully",
                "order" => getOrderWithRelations($db, $id)
            ]);
            break;

        case 'DELETE':
            $id = isset($_GET['id']) ? $_GET['id'] : null;

            if (!$id) {
                http_response_code(400);
                echo json_encode(["success" => false, "message" => "Order ID required"]);
                exit();
            }

            $db->beginTransaction();

            try {
                $deletePaymentsStmt = $db->prepare("DELETE FROM payments WHERE order_id = :order_id");
                $deletePaymentsStmt->bindParam(':order_id', $id);
                $deletePaymentsStmt->execute();

                $deleteProductsStmt = $db->prepare("DELETE FROM service_order_products WHERE order_id = :order_id");
                $deleteProductsStmt->bindParam(':order_id', $id);
                $deleteProductsStmt->execute();

                $stmt = $db->prepare("DELETE FROM service_orders WHERE id = :id");
                $stmt->bindParam(':id', $id);

                if (!$stmt->execute()) {
                    throw new Exception("Failed to delete order");
                }

                $db->commit();

                echo json_encode([
                    "success" => true,
                    "message" => "Order and related payments deleted successfully"
                ]);
            } catch (Exception $e) {
                $db->rollBack();
                http_response_code(500);
                echo json_encode([
                    "success" => false,
                    "message" => "Failed to delete order",
                    "error" => $e->getMessage()
                ]);
            }
            break;

        default:
            http_response_code(405);
            echo json_encode(["success" => false, "message" => "Method not allowed"]);
            break;
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Server error",
        "error" => $e->getMessage()
    ]);
}
?>
