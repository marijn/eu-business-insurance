import * as Option from "fp-ts/Option";
import {LocalDate} from "js-joda";

const effectiveDateOf = (effectiveDate: string | null): Option.Option<LocalDate> => {
    throw new Error("TODO: Implement me!")
};

const effectiveDateToString = (effectiveDate: Option.Option<LocalDate>): string | null => {
    throw new Error("TODO: Implement me!")
}

describe("Effective date", () => {
    const sensibleExamples = [
        null,
        "2026-12-01",
    ];

    test.each(sensibleExamples)("Convert the effective date to and from a text representation", (example) => {
        const actual = effectiveDateToString(effectiveDateOf(example));

        const expected = example;
        expect(actual).toStrictEqual(expected);
    });
});
