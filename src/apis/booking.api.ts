import { apiClient } from "./axiosClient";
import { Booking, BookingStatus, FixedDurationOption } from "@/types/Booking";

export const getAvailabilityApi = async (courtId: string, date: string) => {
  const { data } = await apiClient.get("/bookings/availability", {
    params: { courtId, date },
  });
  return data.data.bookedSlots as string[];
};

export const getFixedDurationsApi = async () => {
  const { data } = await apiClient.get("/bookings/fixed-durations");
  return data.data.options as FixedDurationOption[];
};

export interface CreateBookingPayload {
  courtId: string;
  date: string;
  slots: string[];
  notes?: string;
}

export const createBookingApi = async (payload: CreateBookingPayload) => {
  const { data } = await apiClient.post("/bookings", payload);
  return data.data.booking as Booking;
};

export interface CreateFixedBookingPayload {
  courtId: string;
  startDate: string;
  slots: string[];
  durationMonths: 1 | 3 | 6;
  notes?: string;
}

export const createFixedBookingApi = async (
  payload: CreateFixedBookingPayload,
) => {
  const { data } = await apiClient.post("/bookings/fixed", payload);
  return data.data.booking as Booking;
};

export const listMyBookingsApi = async () => {
  const { data } = await apiClient.get("/bookings/me");
  return data.data.bookings as Booking[];
};

export const cancelMyBookingApi = async (id: string) => {
  const { data } = await apiClient.patch(`/bookings/${id}/cancel`);
  return data.data.booking as Booking;
};

export const listAllBookingsApi = async (params?: {
  status?: BookingStatus;
  date?: string;
  courtId?: string;
}) => {
  const { data } = await apiClient.get("/bookings", { params });
  return data.data.bookings as Booking[];
};

export const updateBookingStatusApi = async (
  id: string,
  status: "confirmed" | "cancelled" | "completed",
  cancelReason?: string,
) => {
  const { data } = await apiClient.patch(`/bookings/${id}/status`, {
    status,
    cancelReason,
  });
  return data.data.booking as Booking;
};
