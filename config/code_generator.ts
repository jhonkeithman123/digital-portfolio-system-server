import crypto from "crypto";

const generateClassroomCode = (): string => {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.randomBytes(10);
  let code = "";

  for (let i = 0; i < 10; i++) {
    code += charset[bytes[i] % charset.length];
  }

  return code;
};

export default generateClassroomCode;
