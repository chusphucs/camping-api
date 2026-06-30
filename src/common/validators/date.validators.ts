import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export const BUSINESS_TIMEZONE = 'Asia/Ho_Chi_Minh';

/** Today's date as 'YYYY-MM-DD' in the business timezone. */
export function businessToday(): string {
  // en-CA formats as YYYY-MM-DD
  return new Date().toLocaleDateString('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
  });
}

/** Validates that this date string is strictly after the value of `property`. */
export function IsAfterDate(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isAfterDate',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const [related] = args.constraints;
          const other = (args.object as Record<string, unknown>)[related];
          if (typeof value !== 'string' || typeof other !== 'string')
            return false;
          return value > other; // ISO date strings compare lexicographically
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be after ${args.constraints[0]}`;
        },
      },
    });
  };
}

/** Validates that this date string is today or later (business timezone). */
export function IsNotPastDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNotPastDate',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;
          return value >= businessToday();
        },
        defaultMessage() {
          return `date must not be in the past`;
        },
      },
    });
  };
}
