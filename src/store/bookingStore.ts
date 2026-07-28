import { create } from "zustand";
import { Booking, BookingStatus } from "@/types/Booking";
import {
  createBookingApi,
  createFixedBookingApi,
  listMyBookingsApi,
  cancelMyBookingApi,
  listAllBookingsApi,
  updateBookingStatusApi,
  CreateBookingPayload,
  CreateFixedBookingPayload,
} from "@/apis/booking.api";

interface BookingStore {
  myBookings: Booking[];
  allBookings: Booking[];
  isLoading: boolean;

  fetchMyBookings: () => Promise<void>;
  createBooking: (
    payload: CreateBookingPayload,
  ) => Promise<{
    success: boolean;
    message: string;
    conflict?: boolean;
    booking?: Booking;
  }>;
  createFixedBooking: (
    payload: CreateFixedBookingPayload,
  ) => Promise<{
    success: boolean;
    message: string;
    conflict?: boolean;
    booking?: Booking;
  }>;
  cancelBooking: (id: string) => Promise<{ success: boolean; message: string }>;

  fetchAllBookings: (params?: {
    status?: BookingStatus;
    date?: string;
    courtId?: string;
  }) => Promise<void>;
  updateBookingStatus: (
    id: string,
    status: "confirmed" | "cancelled" | "completed",
    cancelReason?: string,
  ) => Promise<{ success: boolean; message: string }>;

  upsertBookingRealtime: (booking: Booking) => void;
  getBookingsByUser: (userId: string) => Booking[];
  getAllBookings: () => Booking[];
}

export const useBookingStore = create<BookingStore>((set, get) => ({
  myBookings: [],
  allBookings: [],
  isLoading: false,

  fetchMyBookings: async () => {
    set({ isLoading: true });
    try {
      const myBookings = await listMyBookingsApi();
      set({ myBookings, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  createBooking: async (payload) => {
    try {
      const booking = await createBookingApi(payload);
      set({ myBookings: [booking, ...get().myBookings] });
      return {
        success: true,
        message: "Đặt sân thành công! Nhân viên sẽ xác nhận trong 30 phút.",
        booking,
      };
    } catch (err: any) {
      const errorCode = err?.response?.data?.errorCode;
      return {
        success: false,
        message: err?.response?.data?.message || "Đặt sân thất bại!",
        conflict: errorCode === "SLOT_ALREADY_BOOKED",
      };
    }
  },

  createFixedBooking: async (payload) => {
    try {
      const booking = await createFixedBookingApi(payload);
      set({ myBookings: [booking, ...get().myBookings] });
      return {
        success: true,
        message:
          "Đăng ký gói cố định thành công! Nhân viên sẽ xác nhận trong 30 phút.",
        booking,
      };
    } catch (err: any) {
      const errorCode = err?.response?.data?.errorCode;
      return {
        success: false,
        message: err?.response?.data?.message || "Đăng ký thất bại!",
        conflict: errorCode === "SLOT_ALREADY_BOOKED",
      };
    }
  },

  cancelBooking: async (id) => {
    try {
      const updated = await cancelMyBookingApi(id);
      set({
        myBookings: get().myBookings.map((b) => (b._id === id ? updated : b)),
      });
      return { success: true, message: "Đã huỷ đơn đặt sân." };
    } catch (err: any) {
      return {
        success: false,
        message: err?.response?.data?.message || "Huỷ đơn thất bại!",
      };
    }
  },

  fetchAllBookings: async (params) => {
    set({ isLoading: true });
    try {
      const allBookings = await listAllBookingsApi(params);
      set({ allBookings, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  updateBookingStatus: async (id, status, cancelReason) => {
    try {
      const updated = await updateBookingStatusApi(id, status, cancelReason);
      set({
        allBookings: get().allBookings.map((b) => (b._id === id ? updated : b)),
      });
      return { success: true, message: "Cập nhật trạng thái thành công!" };
    } catch (err: any) {
      return {
        success: false,
        message: err?.response?.data?.message || "Cập nhật thất bại!",
      };
    }
  },

  upsertBookingRealtime: (booking) => {
    set((state) => ({
      myBookings: state.myBookings.some((b) => b._id === booking._id)
        ? state.myBookings.map((b) => (b._id === booking._id ? booking : b))
        : state.myBookings,
      allBookings: state.allBookings.some((b) => b._id === booking._id)
        ? state.allBookings.map((b) => (b._id === booking._id ? booking : b))
        : [booking, ...state.allBookings],
    }));
  },

  getBookingsByUser: (userId) =>
    get().myBookings.filter((b) => b.user === userId),
  getAllBookings: () => get().allBookings,
}));
