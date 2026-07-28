import { create } from "zustand";
import { Court } from "@/types/Courts";
import { Booking, BookingType, FixedDurationOption } from "@/types/Booking";

export type BookingFlowView = "intro" | "catalog" | "detail" | "payment";

interface BookingFlowStore {
  view: BookingFlowView;
  selectedCourt: Court | null;
  selectedDate: string;
  selectedSlots: string[];
  bookingType: BookingType | null;
  selectedDuration: FixedDurationOption | null; // chi dung khi bookingType === "fixed"
  notes: string;
  createdBooking: Booking | null;

  goToIntro: () => void;
  goToCatalog: () => void;
  selectCourt: (court: Court) => void;
  setSelectedDate: (date: string) => void;
  setSelectedSlots: (slots: string[]) => void;
  setBookingType: (t: BookingType | null) => void;
  setSelectedDuration: (d: FixedDurationOption | null) => void;
  setNotes: (notes: string) => void;
  goToPayment: () => void;
  setCreatedBooking: (b: Booking) => void;
  reset: () => void;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

export const useBookingFlowStore = create<BookingFlowStore>((set) => ({
  view: "intro",
  selectedCourt: null,
  selectedDate: todayStr(),
  selectedSlots: [],
  bookingType: null,
  selectedDuration: null,
  notes: "",
  createdBooking: null,

  goToIntro: () => set({ view: "intro", createdBooking: null }),
  goToCatalog: () => set({ view: "catalog", createdBooking: null }),
  selectCourt: (court) =>
    set({
      view: "detail",
      selectedCourt: court,
      selectedDate: todayStr(),
      selectedSlots: [],
      bookingType: null,
      selectedDuration: null,
      createdBooking: null,
    }),
  setSelectedDate: (date) => set({ selectedDate: date, selectedSlots: [] }),
  setSelectedSlots: (slots) => set({ selectedSlots: slots }),
  // Doi loai gia -> reset luon thoi han da chon (tranh giu lai thoi han cu khi chuyen tu Co dinh sang Vang lai roi quay lai)
  setBookingType: (t) => set({ bookingType: t, selectedDuration: null }),
  setSelectedDuration: (d) => set({ selectedDuration: d }),
  setNotes: (notes) => set({ notes }),
  goToPayment: () => set({ view: "payment" }),
  setCreatedBooking: (b) => set({ createdBooking: b }),
  reset: () =>
    set({
      view: "intro",
      selectedCourt: null,
      selectedDate: todayStr(),
      selectedSlots: [],
      bookingType: null,
      selectedDuration: null,
      notes: "",
      createdBooking: null,
    }),
}));
