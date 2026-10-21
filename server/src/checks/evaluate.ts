import type { CheckStatus, MonitorStatus } from "../generated/prisma/enums.js";
import type { AlertType } from "../alerts/types.js";

export type MonitorState = {
  status: MonitorStatus;
  consecutiveFailures: number;
  failureThreshold: number;
};

export type Transition = {
  status: MonitorStatus;
  consecutiveFailures: number;
  statusChanged: boolean;
  alert: AlertType | null;
};

/**
 * Máquina de estados do monitor (função pura, sem I/O).
 *
 * - Sucesso zera as falhas; se o monitor estava DOWN, gera RECOVERED.
 * - Falha só derruba o monitor ao atingir `failureThreshold` falhas seguidas,
 *   evitando alertas por oscilações pontuais (flapping).
 * - O primeiro UP (vindo de PENDING) não gera alerta.
 */
export function evaluateCheck(state: MonitorState, result: CheckStatus): Transition {
  if (result === "UP") {
    return {
      status: "UP",
      consecutiveFailures: 0,
      statusChanged: state.status !== "UP",
      alert: state.status === "DOWN" ? "RECOVERED" : null,
    };
  }

  const consecutiveFailures = state.consecutiveFailures + 1;

  if (state.status === "DOWN") {
    return { status: "DOWN", consecutiveFailures, statusChanged: false, alert: null };
  }

  if (consecutiveFailures >= state.failureThreshold) {
    return { status: "DOWN", consecutiveFailures, statusChanged: true, alert: "DOWN" };
  }

  // Abaixo do limite: mantém o status atual (UP ou PENDING) e só acumula a falha.
  return { status: state.status, consecutiveFailures, statusChanged: false, alert: null };
}
