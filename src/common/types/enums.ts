export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PICKED_UP = 'PICKED_UP',
  RETURNED = 'RETURNED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentStatus {
  UNPAID = 'UNPAID',
  DEPOSIT = 'DEPOSIT',
  PAID = 'PAID',
}

export enum PostStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
}

/** Legal booking status transitions (admin-driven). */
export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.PENDING]: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
  [BookingStatus.CONFIRMED]: [BookingStatus.PICKED_UP, BookingStatus.CANCELLED],
  [BookingStatus.PICKED_UP]: [BookingStatus.RETURNED],
  [BookingStatus.RETURNED]: [],
  [BookingStatus.CANCELLED]: [],
};
