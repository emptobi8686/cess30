import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { toUserError, logServerError } from "@/lib/errors";

describe("toUserError", () => {
  test("unique violations depend on context", () => {
    assert.equal(
      toUserError({ code: "23505" }, "matric"),
      "This matriculation number is already registered. Contact your course representative."
    );
    assert.equal(toUserError({ code: "23505" }, "course"), "A course with this code already exists.");
    assert.equal(
      toUserError({ code: "23505" }, "lecture"),
      "An identical session already exists for this course, date and time."
    );
  });
  test("common constraint and permission codes", () => {
    assert.equal(toUserError({ code: "23503" }, "generic"), "This item is referenced elsewhere and cannot be removed.");
    assert.equal(toUserError({ code: "42501" }, "generic"), "You do not have permission to perform this action.");
    assert.equal(toUserError({ code: "22P02" }, "generic"), "The request contained an invalid identifier.");
    assert.equal(toUserError({ code: "23514" }, "generic"), "Some values are outside the allowed limits.");
  });
  test("unknown errors are generic and never echo the raw message", () => {
    const message = toUserError({ code: "XX000", message: "secret detail about tables" }, "generic");
    assert.equal(message, "Something went wrong. Please try again.");
    assert.ok(!message.includes("secret"));
    assert.equal(toUserError(new Error("boom"), "study"), "Something went wrong. Please try again.");
    assert.equal(toUserError(null, "generic"), "Something went wrong. Please try again.");
  });
});

describe("logServerError", () => {
  test("returns a short reference id", () => {
    const original = console.error;
    console.error = () => undefined;
    try {
      assert.match(logServerError("test", { code: "X", message: "m" }), /^err_[a-z0-9]{6}$/);
    } finally {
      console.error = original;
    }
  });
});
