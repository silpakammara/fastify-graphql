export const sanitizeData = <T extends Record<string, any>>(data: T): T => {
  const sanitizedData: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    // 1️⃣ Nullify placeholder string/number values
    if (
      value === "string" ||
      value === 0 ||
      value === "0" ||
      value === "null" ||
      value === null ||
      value === undefined
    ) {
      sanitizedData[key] = null;
    }
    else if (Array.isArray(value)) {
      const cleanedArr = value.filter(v => v !== "string" && v !== "" && v !== null && v !== undefined);
      sanitizedData[key] = cleanedArr.length > 0 ? cleanedArr : [];
    }
    else if (typeof value === "object" && value !== null) {
      const cleanedObj: Record<string, any> = {};
      for (const [objKey, objVal] of Object.entries(value)) {
        if (objVal !== "string" && objVal !== "" && objVal !== null && objVal !== undefined) {
          cleanedObj[objKey] = objVal;
        }
      }
      sanitizedData[key] = Object.keys(cleanedObj).length > 0 ? cleanedObj : {};
    }
    else {
      sanitizedData[key] = value;
    }
  }

  return sanitizedData as T;
};

export const sanitizeField = (value: any) => {
    if (value === '' || value === undefined) return null;
    return value;
  };