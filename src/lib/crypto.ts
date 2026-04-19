export const initE2E = async (username: string) => {
  const existingKey = localStorage.getItem(`privateKey_${username}`);
  if (existingKey) return;

  const { publicKey, privateKey } = await generateKeyPair();
  localStorage.setItem(`privateKey_${username}`, privateKey);
  localStorage.setItem(`publicKey_${username}`, publicKey);

  await fetch("/api/users/update-key", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, publicKey }),
  });
};

export const generateKeyPair = async () => {
  const keyPair = await window.crypto.subtle.generateKey(
    { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["encrypt", "decrypt"]
  );
  const publicKey = btoa(String.fromCharCode(...new Uint8Array(await window.crypto.subtle.exportKey("spki", keyPair.publicKey))));
  const privateKey = btoa(String.fromCharCode(...new Uint8Array(await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey))));
  return { publicKey, privateKey };
};

export const encryptMessage = async (text: string, publicKeyStr: string) => {
  try {
    const binaryDer = Uint8Array.from(atob(publicKeyStr), c => c.charCodeAt(0));
    const publicKey = await window.crypto.subtle.importKey("spki", binaryDer, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["encrypt"]);
    const encoded = new TextEncoder().encode(text);
    const encrypted = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, encoded);
    return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  } catch (e) { return text; }
};

export const decryptMessage = async (encryptedBase64: string, username: string) => {
  try {
    const privateKeyStr = localStorage.getItem(`privateKey_${username}`);
    if (!privateKeyStr) return "[Ключ не найден]";
    const binaryDer = Uint8Array.from(atob(privateKeyStr), c => c.charCodeAt(0));
    const privateKey = await window.crypto.subtle.importKey("pkcs8", binaryDer, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["decrypt"]);
    const encryptedData = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
    const decrypted = await window.crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, encryptedData);
    return new TextDecoder().decode(decrypted);
  } catch (e) { return "[Зашифровано]"; }
};

export const getMyPublicKey = () => {
  return localStorage.getItem(`publicKey_${localStorage.getItem('currentUser')}`); 
  // Убедись, что ты сохраняешь имя текущего юзера в localStorage при входе
};