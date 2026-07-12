import * as Option from "fp-ts/lib/Option";
import {LocalDate} from "@js-joda/core";
import {pipe} from "fp-ts/lib/function";

export const effectiveDateOf = (effectiveDate?: string | null | undefined): Option.Option<LocalDate> => {
    return pipe(
        Option.fromNullable(effectiveDate),
        Option.flatMap(
            (effectiveDate) => Option.tryCatch(() => LocalDate.parse(effectiveDate))
        )
    );
};

export const effectiveDateToString = (effectiveDate: Option.Option<LocalDate>): string | null => {
    return pipe(
        effectiveDate,
        Option.map((effectiveDate) => effectiveDate.toString()),
        Option.toNullable
    );
}
