// src/pages/booking-flow/CourtDetailView.tsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Button, Alert, Chip, CircularProgress } from "@mui/material";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/vi";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import StarIcon from "@mui/icons-material/Star";
import BoltIcon from "@mui/icons-material/Bolt";
import { useAuthStore } from "@/store/authStore";
import { useBookingFlowStore } from "@/store/bookingFlowStore";
import { getAvailabilityApi, getFixedDurationsApi } from "@/apis/booking.api";
import { getSocket } from "@/lib/socket";
import { getCourtIcon } from "@/config/courtIcons";
import {
  formatCurrency,
  areConsecutive,
  buildTimeRange,
} from "@/utils/helpers";
import { TIME_SLOTS, BookingType, FixedDurationOption } from "@/types/Booking";
import { PriceRule } from "@/types/Courts";
import LoginPromptDialog from "@/components/auth/LoginPromptDialog";
import { useNotification } from "@/hooks/useNotification";
import NotificationSnackbar from "@/components/shared/NotificationSnackbar";

const toMinutes = (t: string): number => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const getPreviewPrice = (
  slot: string,
  rules: PriceRule[],
  type: BookingType,
): number | null => {
  const slotMin = toMinutes(slot);
  const rule = rules.find((r) => {
    const startMin = toMinutes(r.startTime);
    const endMin = r.endTime === "24:00" ? 24 * 60 : toMinutes(r.endTime);
    return slotMin >= startMin && slotMin < endMin;
  });
  if (!rule) return null;
  return type === "fixed" ? rule.pricePerHourFixed : rule.pricePerHourCasual;
};

// Chi de HIEN THI TRUOC so buoi cua goi co dinh - so lieu chinh xac cuoi cung
// luon do BE tinh lai va tra ve trong booking sau khi dat thanh cong.
const buildFixedOccurrencesPreview = (
  startDate: string,
  months: number,
): string[] => {
  const start = dayjs(startDate);
  const end = start.add(months, "month");
  const dates: string[] = [];
  let current = start;
  while (current.isBefore(end)) {
    dates.push(current.format("YYYY-MM-DD"));
    current = current.add(7, "day");
  }
  return dates;
};

const CourtDetailView: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const {
    selectedCourt,
    selectedDate,
    selectedSlots,
    bookingType,
    selectedDuration,
    goToCatalog,
    setSelectedDate,
    setSelectedSlots,
    setBookingType,
    setSelectedDuration,
    goToPayment,
  } = useBookingFlowStore();
  const { notification, notify, close: closeNotif } = useNotification();

  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [fixedDurations, setFixedDurations] = useState<FixedDurationOption[]>(
    [],
  );

  const dateObj = dayjs(selectedDate);
  const todayStr = dayjs().format("YYYY-MM-DD");
  const currentHour = dayjs().hour();
  const isFixedMode = bookingType === "fixed";

  useEffect(() => {
    getFixedDurationsApi()
      .then(setFixedDurations)
      .catch(() => notify("Không tải được danh sách gói cố định!", "error"));
  }, []); // eslint-disable-line

  const loadAvailability = useCallback(async () => {
    if (!selectedCourt) return;
    setLoadingSlots(true);
    try {
      const slots = await getAvailabilityApi(selectedCourt._id, selectedDate);
      setBookedSlots(slots);
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedCourt, selectedDate]);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);

  useEffect(() => {
    if (!selectedCourt) return;
    const socket = getSocket();
    if (!socket) return;
    socket.emit("slots:join", {
      courtId: selectedCourt._id,
      date: selectedDate,
    });
    const handleSlotsUpdated = (payload: {
      courtId: string;
      date: string;
      bookedSlots: string[];
    }) => {
      if (
        payload.courtId !== selectedCourt._id ||
        payload.date !== selectedDate
      )
        return;
      setBookedSlots(payload.bookedSlots);
      const taken = selectedSlots.filter((s) =>
        payload.bookedSlots.includes(s),
      );
      if (taken.length > 0) {
        notify(
          "Một số khung giờ bạn chọn vừa được người khác đặt trước, đã tự bỏ chọn.",
          "warning",
        );
        setSelectedSlots(
          selectedSlots.filter((s) => !payload.bookedSlots.includes(s)),
        );
      }
    };
    socket.on("slots:updated", handleSlotsUpdated);
    return () => {
      socket.emit("slots:leave", {
        courtId: selectedCourt._id,
        date: selectedDate,
      });
      socket.off("slots:updated", handleSlotsUpdated);
    };
  }, [selectedCourt, selectedDate]); // eslint-disable-line

  if (!selectedCourt) {
    goToCatalog();
    return null;
  }

  const CourtIcon = getCourtIcon(selectedCourt.image);
  const priceRules = selectedCourt.category?.priceRules || [];

  const isPastSlot = (time: string): boolean => {
    if (selectedDate > todayStr) return false;
    if (selectedDate < todayStr) return true;
    return parseInt(time.split(":")[0]) <= currentHour;
  };

  const getSlotState = (time: string) => {
    if (bookedSlots.includes(time)) return "booked";
    if (isPastSlot(time)) return "past";
    if (selectedSlots.includes(time)) return "selected";
    return "available";
  };

  const toggleSlot = (time: string) => {
    const state = getSlotState(time);
    if (state === "booked" || state === "past") return;
    setSelectedSlots(
      selectedSlots.includes(time)
        ? selectedSlots.filter((s) => s !== time)
        : [...selectedSlots, time].sort(),
    );
  };

  const {
    start: startTime,
    end: endTime,
    hours,
  } = buildTimeRange(selectedSlots);
  const isContiguous = areConsecutive(selectedSlots);

  // Gia cho 1 buoi/1 tuan (chua nhan so buoi)
  const weeklyPreviewTotal = useMemo(() => {
    if (!bookingType || selectedSlots.length === 0) return null;
    let sum = 0;
    for (const slot of selectedSlots) {
      const price = getPreviewPrice(slot, priceRules, bookingType);
      if (price === null) return null;
      sum += price;
    }
    return sum;
  }, [bookingType, selectedSlots, priceRules]);

  // Preview gói cố định: nhân theo so buoi trong toan bo thoi han
  const fixedPreview = useMemo(() => {
    if (!isFixedMode || !selectedDuration || weeklyPreviewTotal === null)
      return null;
    const occurrences = buildFixedOccurrencesPreview(
      selectedDate,
      selectedDuration.months,
    );
    return { occurrences, totalPrice: weeklyPreviewTotal * occurrences.length };
  }, [isFixedMode, selectedDuration, weeklyPreviewTotal, selectedDate]);

  const finalPreviewTotal = isFixedMode
    ? (fixedPreview?.totalPrice ?? null)
    : weeklyPreviewTotal;

  const canContinue =
    selectedSlots.length > 0 &&
    isContiguous &&
    !!bookingType &&
    weeklyPreviewTotal !== null &&
    (!isFixedMode || !!selectedDuration);

  const handleContinue = () => {
    if (!canContinue) return;
    if (!isAuthenticated) {
      setLoginDialogOpen(true);
      return;
    }
    goToPayment();
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="vi">
      <div className="fade-in-up">
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={goToCatalog}
          sx={{ mb: 2, color: "#1a472a", fontWeight: 700 }}>
          Quay lại danh sách sân
        </Button>

        <div
          style={{
            background: "white",
            borderRadius: 14,
            padding: "18px 22px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            boxShadow: "0 2px 8px rgba(26,71,42,0.08)",
            border: "2px solid #52b788",
            marginBottom: 20,
          }}>
          <CourtIcon sx={{ fontSize: 40, color: "#1a472a" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 19, color: "#1a472a" }}>
              {selectedCourt.name}
            </div>
            <div style={{ fontSize: 13, color: "#718096" }}>
              {selectedCourt.description}
            </div>
            <Chip
              label={selectedCourt.category?.name}
              size="small"
              color="success"
              variant="outlined"
              sx={{ mt: 0.5 }}
            />
          </div>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            Bảng giá — {selectedCourt.category?.name}
          </div>
          <div className="card-body">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {priceRules.map((r, i) => (
                <div
                  key={i}
                  style={{
                    background: "#f8faf9",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 13,
                  }}>
                  <strong>
                    {r.startTime}–{r.endTime}
                  </strong>
                  {" — "}
                  <StarIcon
                    sx={{
                      fontSize: 13,
                      color: "#b45309",
                      verticalAlign: "middle",
                    }}
                  />{" "}
                  {formatCurrency(r.pricePerHourFixed)}
                  {" / "}
                  <BoltIcon
                    sx={{
                      fontSize: 13,
                      color: "#1e40af",
                      verticalAlign: "middle",
                    }}
                  />{" "}
                  {formatCurrency(r.pricePerHourCasual)}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "300px 1fr",
            gap: 20,
          }}>
          <div className="card">
            <div className="card-header">
              {isFixedMode ? "Chọn ngày bắt đầu" : "Chọn ngày"}
            </div>
            <div style={{ padding: "0 4px 8px" }}>
              <DateCalendar
                value={dateObj}
                onChange={(v: Dayjs | null) =>
                  v && setSelectedDate(v.format("YYYY-MM-DD"))
                }
                minDate={dayjs()}
                maxDate={dayjs().add(isFixedMode ? 60 : 30, "day")}
                sx={{
                  width: "100%",
                  "& .MuiPickersDay-root.Mui-selected": {
                    background:
                      "linear-gradient(135deg,#1a472a,#2d6a4f) !important",
                  },
                }}
              />
            </div>
            <div
              style={{
                margin: "0 16px 16px",
                padding: "10px 14px",
                background: "#e8f5e9",
                borderRadius: 10,
                fontSize: 13,
                color: "#1a472a",
                fontWeight: 700,
                textAlign: "center",
              }}>
              {dateObj.format("dddd, DD/MM/YYYY")}
            </div>

            {/* Chon loai gia */}
            <div style={{ margin: "0 16px 16px" }}>
              {selectedSlots.length > 0 && !bookingType && (
                <div
                  style={{
                    fontSize: 11,
                    color: "#dc2626",
                    fontWeight: 700,
                    marginBottom: 6,
                  }}>
                  ⚠ Bạn cần chọn 1 trong 2 mục dưới đây để tiếp tục
                </div>
              )}
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#4a5568",
                  marginBottom: 8,
                }}>
                Chọn loại giá:
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div
                  onClick={() => setBookingType("fixed" as BookingType)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    borderRadius: 8,
                    cursor: "pointer",
                    border:
                      bookingType === "fixed"
                        ? "2px solid #b45309"
                        : "1px solid #e5e7eb",
                    background: bookingType === "fixed" ? "#fef3c7" : "white",
                  }}>
                  <StarIcon sx={{ color: "#b45309" }} fontSize="small" />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>Cố định</div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>
                      Đăng ký gói dài hạn 1/3/6 tháng
                    </div>
                  </div>
                </div>
                <div
                  onClick={() => setBookingType("casual" as BookingType)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    borderRadius: 8,
                    cursor: "pointer",
                    border:
                      bookingType === "casual"
                        ? "2px solid #1e40af"
                        : "1px solid #e5e7eb",
                    background: bookingType === "casual" ? "#dbeafe" : "white",
                  }}>
                  <BoltIcon sx={{ color: "#1e40af" }} fontSize="small" />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>
                      Vãng lai
                    </div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>
                      Đặt lẻ 1 buổi
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Chon thoi han goi - CHI hien khi chon Co dinh */}
            {isFixedMode && (
              <div style={{ margin: "0 16px 16px" }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#4a5568",
                    marginBottom: 8,
                  }}>
                  Chọn thời hạn gói:
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {fixedDurations.map((d) => (
                    <div
                      key={d.months}
                      onClick={() => setSelectedDuration(d)}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 12px",
                        borderRadius: 8,
                        cursor: "pointer",
                        border:
                          selectedDuration?.months === d.months
                            ? "2px solid #1a472a"
                            : "1px solid #e5e7eb",
                        background:
                          selectedDuration?.months === d.months
                            ? "#e8f5e9"
                            : "white",
                      }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>
                        {d.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}>
                <span>
                  Khung giờ{" "}
                  {loadingSlots && (
                    <CircularProgress size={12} sx={{ ml: 1 }} />
                  )}
                </span>
                {selectedSlots.length > 0 && (
                  <Chip
                    label={`${selectedSlots.length} giờ đã chọn`}
                    color="success"
                    size="small"
                    onDelete={() => setSelectedSlots([])}
                    sx={{ fontWeight: 700 }}
                  />
                )}
              </div>
            </div>
            <div className="card-body">
              <div className="slots-legend" style={{ marginBottom: 16 }}>
                {[
                  { cls: "available", label: "Còn trống" },
                  { cls: "booked", label: "Đã đặt" },
                  { cls: "selected", label: "Đang chọn" },
                  { cls: "past", label: "Đã qua" },
                ].map((l) => (
                  <div className="legend-item" key={l.cls}>
                    <div className={`legend-dot ${l.cls}`} />
                    <span>{l.label}</span>
                  </div>
                ))}
              </div>

              {isFixedMode && (
                <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
                  Với gói cố định, hệ thống chỉ kiểm tra khung giờ trống của{" "}
                  <strong>ngày bắt đầu</strong> bên dưới — các tuần tiếp theo sẽ
                  được BE xác nhận chính xác khi bạn hoàn tất đăng ký.
                </Alert>
              )}

              {!isContiguous && selectedSlots.length > 1 && (
                <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                  Vui lòng chọn các khung giờ <strong>liên tiếp nhau</strong>!
                </Alert>
              )}
              {selectedSlots.length > 0 &&
                bookingType &&
                weeklyPreviewTotal === null && (
                  <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                    Một số khung giờ đã chọn chưa được thiết lập giá. Vui lòng
                    chọn khung giờ khác.
                  </Alert>
                )}

              <div className="slots-grid">
                {TIME_SLOTS.map((time) => {
                  const state = getSlotState(time);
                  const endH = parseInt(time.split(":")[0]) + 1;
                  return (
                    <button
                      key={time}
                      className={`time-slot-btn ${state}`}
                      onClick={() => toggleSlot(time)}>
                      <span className="slot-time">
                        {time}–{String(endH).padStart(2, "0")}:00
                      </span>
                      <span className="slot-price">
                        {state === "booked"
                          ? "Đã đặt"
                          : state === "past"
                            ? "Đã qua"
                            : "Trống"}
                      </span>
                    </button>
                  );
                })}
              </div>

              {isFixedMode && fixedPreview && (
                <Alert severity="success" sx={{ mt: 2, borderRadius: 2 }}>
                  Lịch dự kiến:{" "}
                  <strong>{fixedPreview.occurrences.length} buổi</strong>, từ{" "}
                  <strong>
                    {dayjs(fixedPreview.occurrences[0]).format("DD/MM/YYYY")}
                  </strong>{" "}
                  đến{" "}
                  <strong>
                    {dayjs(
                      fixedPreview.occurrences[
                        fixedPreview.occurrences.length - 1
                      ],
                    ).format("DD/MM/YYYY")}
                  </strong>{" "}
                  (mỗi {dateObj.format("dddd")})
                </Alert>
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            marginTop: 20,
            gap: 16,
            flexWrap: "wrap",
          }}>
          {canContinue && finalPreviewTotal !== null && (
            <div
              style={{
                background: "white",
                borderRadius: 12,
                padding: "12px 20px",
                border: "2px solid #52b788",
                display: "flex",
                gap: 24,
                alignItems: "center",
                boxShadow: "0 2px 8px rgba(26,71,42,0.08)",
              }}>
              <div>
                <div style={{ fontSize: 11, color: "#718096" }}>
                  {isFixedMode ? "Số buổi" : "Thời gian"}
                </div>
                <div style={{ fontWeight: 700, color: "#1a472a" }}>
                  {isFixedMode
                    ? `${fixedPreview?.occurrences.length} buổi`
                    : `${startTime} – ${endTime} (${hours}h)`}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#718096" }}>Tổng tiền</div>
                <div
                  style={{ fontWeight: 800, fontSize: 18, color: "#1a472a" }}>
                  {formatCurrency(finalPreviewTotal)}
                </div>
              </div>
            </div>
          )}
          <Button
            variant="contained"
            disabled={!canContinue}
            onClick={handleContinue}
            sx={{
              background: "linear-gradient(135deg,#1a472a,#2d6a4f)",
              fontWeight: 700,
              px: 3,
              py: 1.3,
              "&:hover": { background: "#0d2614" },
              "&:disabled": { background: "#e5e7eb" },
            }}>
            {isAuthenticated
              ? "Tiếp tục đến thanh toán →"
              : "Đăng nhập để tiếp tục →"}
          </Button>
        </div>
      </div>

      <LoginPromptDialog
        open={loginDialogOpen}
        onClose={() => setLoginDialogOpen(false)}
        onSuccess={() => goToPayment()}
      />
      <NotificationSnackbar
        open={notification.open}
        msg={notification.msg}
        type={notification.type}
        onClose={closeNotif}
      />
    </LocalizationProvider>
  );
};

export default CourtDetailView;
