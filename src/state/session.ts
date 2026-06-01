const WHO = "bandon_player", AUTHED = "bandon_authed";
export const getPlayerId = () => localStorage.getItem(WHO);
export const setPlayerId = (id: string) => localStorage.setItem(WHO, id);
export const isAuthed = () => localStorage.getItem(AUTHED) === "1";
export const setAuthed = (v: boolean) => localStorage.setItem(AUTHED, v ? "1" : "0");
