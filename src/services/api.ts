import axios, { type AxiosError } from "axios";
import authService from "./authService";

// 1. 주소 설정 로직을 여기서도 똑같이 적용해야 합니다.
const API_BASE_URL = import.meta.env.PROD
  ? "https://nextdream.store/api"
  : "/api";

const api = axios.create({
  baseURL: API_BASE_URL, // 수정된 주소 적용
  headers: {
    "Content-Type": "application/json",
  },
});

// 2. 요청 인터셉터 (여기가 문제였습니다!)
// authService를 통해 가져오지 말고, 스토리지에서 '직접' 꺼내야 순환 참조 문제를 피합니다.
api.interceptors.request.use(
  (config) => {
    // authService.getAccessToken() 대신 직접 조회
    const token =
      localStorage.getItem("accessToken") ||
      sessionStorage.getItem("accessToken");

    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor (토큰 만료 시 처리)
let isRefreshing = false;
let failedQueue: {
  resolve: (value: unknown) => void;
  reject: (reason?: any) => void;
}[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !(originalRequest as any)._retry
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            (originalRequest as any).headers["Authorization"] =
              "Bearer " + token;
            return axios(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      (originalRequest as any)._retry = true;
      isRefreshing = true;

      try {
        const newAccessToken = await authService.refreshToken();

        if (newAccessToken) {
          (originalRequest as any).headers["Authorization"] =
            "Bearer " + newAccessToken;
          processQueue(null, newAccessToken);
          // 재요청 시에도 baseURL을 확실하게 적용
          originalRequest.baseURL = API_BASE_URL;
          return axios(originalRequest);
        } else {
          processQueue(new Error("Session expired."), null);
          window.location.href = "/login";
          return Promise.reject(error);
        }
      } catch (err) {
        processQueue(err, null);
        window.location.href = "/login";
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
