import api from "./api";
import { IRegisterData, ILoginData, ILoginResponse } from "./type";

export const register = async (data: IRegisterData) => {
    try {
        const res = await api.post("/register/", data);
        return res;
    } catch (error: any) {
        throw new Error(error.response?.data?.message || "Registration failed");
    }
};

export const login = async (data: ILoginData): Promise<ILoginResponse> => {
    try {
        const res = await api.post<ILoginResponse>("/login/", data);
        localStorage.setItem("accessToken", res.data.tokens.access);
        localStorage.setItem("refreshToken", res.data.tokens.refresh);
        return res.data;
    } catch (error: any) {
        throw new Error(error.response?.data?.message || "Login failed");
    }
};

export const logout = async () => {
    try {
        const refresh = localStorage.getItem("refreshToken");
        if (refresh) {
            await api.post("/logout/", { refresh });
        }
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
    }
};

export const getUserInfo = async () => {
    try {
        const res = await api.get("/user-info/");
        return res.data;
    } catch (error: any) {
        throw new Error(error.response?.data?.message || "Failed to fetch user info");
    }
};
