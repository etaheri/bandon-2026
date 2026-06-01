const WHO = "bandon_player", AUTHED = "bandon_authed", ROLE = "bandon_role";
export const getPlayerId = () => localStorage.getItem(WHO);
export const setPlayerId = (id: string) => localStorage.setItem(WHO, id);
export const isAuthed = () => localStorage.getItem(AUTHED) === "1";
export const setAuthed = (v: boolean) => localStorage.setItem(AUTHED, v ? "1" : "0");
export const getRole = () => localStorage.getItem(ROLE);
export const setRole = (r: string) => localStorage.setItem(ROLE, r);
export const isAdmin = () => localStorage.getItem(ROLE) === "admin";
