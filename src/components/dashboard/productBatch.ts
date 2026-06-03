export interface ProductNameSerialPair {
  productName: string;
  serialNumber: string;
}

const MULTI_VALUE_SEPARATOR = /[\r\n\t,;|]+/;
// Split serial numbers by whitespace/comma/semicolon/pipe so scanner/manual space-separated input creates multiple rows.
const SERIAL_MULTI_VALUE_SEPARATOR = /[\s,;|]+/;

export const splitBatchValues = (value: string): string[] =>
  value
    .split(MULTI_VALUE_SEPARATOR)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

export const splitSerialBatchValues = (value: string): string[] =>
  value
    .split(SERIAL_MULTI_VALUE_SEPARATOR)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

export const expandProductNameSerialPairs = (
  productNameInput: string,
  serialNumberInput: string,
): { pairs: ProductNameSerialPair[]; error?: string } => {
  const productNames = splitBatchValues(productNameInput);
  const serialNumbers = splitSerialBatchValues(serialNumberInput);
  const normalizedUniqueNames = Array.from(new Set(productNames.map((name) => name.trim()).filter(Boolean)));
  const hasSingleLogicalName = normalizedUniqueNames.length === 1;
  const singleLogicalName = hasSingleLogicalName ? normalizedUniqueNames[0] : "";

  if (productNames.length === 0) {
    return { pairs: [], error: "Product name is required" };
  }

  if (productNames.length > 1 && serialNumbers.length === 1) {
    if (hasSingleLogicalName) {
      return {
        pairs: [
          {
            productName: singleLogicalName,
            serialNumber: serialNumbers[0],
          },
        ],
      };
    }
    return {
      pairs: [],
      error: "When using multiple product names, provide one serial per product or leave serial numbers empty",
    };
  }

  if (productNames.length > 1 && serialNumbers.length > 1 && productNames.length !== serialNumbers.length) {
    if (hasSingleLogicalName) {
      return {
        pairs: serialNumbers.map((serialNumber) => ({
          productName: singleLogicalName,
          serialNumber,
        })),
      };
    }
    return {
      pairs: [],
      error: "Product name count and serial number count must match",
    };
  }

  if (productNames.length === 1 && serialNumbers.length > 1) {
    return {
      pairs: serialNumbers.map((serialNumber) => ({
        productName: productNames[0],
        serialNumber,
      })),
    };
  }

  if (productNames.length > 1) {
    return {
      pairs: productNames.map((productName, index) => ({
        productName,
        serialNumber: serialNumbers[index] || "",
      })),
    };
  }

  return {
    pairs: [
      {
        productName: productNames[0],
        serialNumber: serialNumbers[0] || "",
      },
    ],
  };
};
