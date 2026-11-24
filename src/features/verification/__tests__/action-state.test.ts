import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { rpcErrorToMessage, GENERIC_ACTION_ERROR } from "@/features/verification/action-state";

describe("rpcErrorToMessage", () => {
  test("duplicate matric", () => {
    assert.equal(
      rpcErrorToMessage({ code: "23505", message: "duplicate key value violates unique constraint" }),
      "This matriculation number is already registered. Contact your course representative."
    );
  });

  test("already reviewed", () => {
    assert.equal(
      rpcErrorToMessage({ message: "This profile has already been reviewed with status: verified." }),
      "This profile has already been reviewed."
    );
  });

  test("self review", () => {
    assert.equal(
      rpcErrorToMessage({ message: "Administrators cannot review their own profile." }),
      "You cannot review your own profile."
    );
    assert.equal(
      rpcErrorToMessage({ message: "Administrators cannot change their own verification status." }),
      "You cannot review your own profile."
    );
  });

  test("known validation messages pass through", () => {
    assert.equal(
      rpcErrorToMessage({ message: "Rejection reason must be at least 12 characters." }),
      "Rejection reason must be at least 12 characters."
    );
    assert.equal(
      rpcErrorToMessage({ message: "A suspension reason of at least 12 characters is required." }),
      "A suspension reason of at least 12 characters is required."
    );
    assert.equal(
      rpcErrorToMessage({ message: "Enter a valid matriculation number." }),
      "Enter a valid matriculation number."
    );
  });

  test("anything else is generic and never leaks the raw message", () => {
    const message = rpcErrorToMessage({ code: "XX000", message: "internal detail about tables" });
    assert.equal(message, GENERIC_ACTION_ERROR);
    assert.equal(GENERIC_ACTION_ERROR, "The action could not be completed. Please try again.");
  });
});
