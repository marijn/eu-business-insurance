import * as Option from "fp-ts/Option";
import {effectiveDateOf, effectiveDateToString} from "./EffectiveDate";

describe("Effective date", () => {
    const sensibleExamples = [
        null,
        "2026-12-01",
        "2024-02-29",
    ];

    test.each(sensibleExamples)("Convert the effective date to and from a text representation", (example) => {
        const actual = effectiveDateToString(effectiveDateOf(example));

        const expected = example;
        expect(actual).toStrictEqual(expected);
    });

    const nonSensibleExamples = [
        "2026-13-01",
        "2026-02-29",
    ];
    test.each(nonSensibleExamples)("Ignores non-sensical dates", (nonSensibleExample: string) => {
        const actual = effectiveDateOf(nonSensibleExample);

        const expected = Option.none;
        expect(actual).toStrictEqual(expected);
    })
});
