export type ApiOk<T> = {
  status: "ok" | "error";
  data?: T;
  message?: string;
};
