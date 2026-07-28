export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";
export type BookingType = "fixed" | "casual";

export const TIME_SLOTS: string[] = [
  "00:00",
  "01:00",
  "02:00",
  "03:00",
  "04:00",
  "05:00",
  "06:00",
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
  "23:00",
];

export interface PriceBreakdownItem {
  time: string;
  price: number;
}

export interface FixedDurationOption {
  months: 1 | 3 | 6;
  label: string;
}

export interface Booking {
  _id: string;
  user: string;
  userName: string;
  userEmail: string;
  court: string;
  courtName: string;
  categoryName: string;
  bookingType: BookingType;
  date: string;
  slots: string[];
  startTime: string;
  endTime: string;
  hours: number;
  pricePerHour: number;
  totalPrice: number;
  priceBreakdown: PriceBreakdownItem[];
  durationMonths?: 1 | 3 | 6;
  startDate?: string;
  endDate?: string;
  occurrenceDates?: string[];
  status: BookingStatus;
  notes: string;
  cancelledBy?: string | null;
  cancelReason?: string;
  createdAt: string;
  updatedAt: string;
}
