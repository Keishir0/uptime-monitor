import { describe, expect, it } from "vitest";
import { evaluateCheck, type MonitorState } from "./evaluate.js";

const state = (overrides: Partial<MonitorState> = {}): MonitorState => ({
  status: "UP",
  consecutiveFailures: 0,
  failureThreshold: 2,
  ...overrides,
});

describe("evaluateCheck", () => {
  it("primeiro check com sucesso vira UP sem alerta", () => {
    expect(evaluateCheck(state({ status: "PENDING" }), "UP")).toEqual({
      status: "UP",
      consecutiveFailures: 0,
      statusChanged: true,
      alert: null,
    });
  });

  it("falha abaixo do limite mantém UP e acumula a contagem", () => {
    expect(evaluateCheck(state(), "DOWN")).toEqual({
      status: "UP",
      consecutiveFailures: 1,
      statusChanged: false,
      alert: null,
    });
  });

  it("atingir o limite derruba o monitor e gera alerta DOWN", () => {
    expect(evaluateCheck(state({ consecutiveFailures: 1 }), "DOWN")).toEqual({
      status: "DOWN",
      consecutiveFailures: 2,
      statusChanged: true,
      alert: "DOWN",
    });
  });

  it("com limite 1, a primeira falha já alerta (inclusive vindo de PENDING)", () => {
    const result = evaluateCheck(state({ status: "PENDING", failureThreshold: 1 }), "DOWN");
    expect(result).toMatchObject({ status: "DOWN", alert: "DOWN", statusChanged: true });
  });

  it("falhas seguidas com o monitor já DOWN não repetem o alerta", () => {
    expect(evaluateCheck(state({ status: "DOWN", consecutiveFailures: 5 }), "DOWN")).toEqual({
      status: "DOWN",
      consecutiveFailures: 6,
      statusChanged: false,
      alert: null,
    });
  });

  it("sucesso após DOWN gera RECOVERED e zera as falhas", () => {
    expect(evaluateCheck(state({ status: "DOWN", consecutiveFailures: 3 }), "UP")).toEqual({
      status: "UP",
      consecutiveFailures: 0,
      statusChanged: true,
      alert: "RECOVERED",
    });
  });

  it("oscilação (falha isolada entre sucessos) nunca alerta", () => {
    let current = state();
    for (const result of ["DOWN", "UP", "DOWN", "UP"] as const) {
      const transition = evaluateCheck(current, result);
      expect(transition.alert).toBeNull();
      current = { ...current, ...transition };
    }
  });
});
