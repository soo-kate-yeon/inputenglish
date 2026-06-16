import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

// Supabase client throws at import without env vars; it is unused in fixture mode.
jest.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: jest.fn() } },
}));

// YouTubePlayer pulls in react-native-webview native modules unavailable in jest.
jest.mock("../../player/YouTubePlayer", () => {
  const ReactMock = require("react");
  const { View } = require("react-native");
  return ReactMock.forwardRef(
    (_props: unknown, ref: React.ForwardedRef<Record<string, unknown>>) => {
      ReactMock.useImperativeHandle(ref, () => ({
        seekTo: jest.fn(),
        getCurrentTime: jest.fn(() => Promise.resolve(0)),
        getDuration: jest.fn(() => Promise.resolve(60)),
      }));
      return ReactMock.createElement(View, { testID: "youtube-player" });
    },
  );
});

import { ImmersiveThemeProvider } from "@/components/ui";
import { ciSessionFixture } from "@/fixtures/ci-session";
import CiSessionScreen from "../CiSessionScreen";

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderScreen(onClose = jest.fn()) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ImmersiveThemeProvider>
        <CiSessionScreen
          session={ciSessionFixture}
          remainingQuestionCap={100}
          onClose={onClose}
        />
      </ImmersiveThemeProvider>
    </SafeAreaProvider>,
  );
}

describe("CiSessionScreen (v1.3 learning flow)", () => {
  it("renders the reading step with the question cap and step nav", () => {
    const { getByText, getAllByText, getByTestId } = renderScreen();
    expect(getByTestId("premium-article-reader")).toBeTruthy();
    expect(getByText("The Last Shipment")).toBeTruthy();
    expect(getByText("질문 100개")).toBeTruthy();
    // "읽기" appears as both the reader eyebrow and the step chip.
    expect(getAllByText("읽기").length).toBeGreaterThanOrEqual(1);
    expect(getByText("영상 1")).toBeTruthy();
    expect(getByText("영상 2")).toBeTruthy();
  });

  it("opens the question agent on word tap and returns a short answer", async () => {
    const { getByTestId, getByText, findByText } = renderScreen();

    fireEvent.press(getByTestId("word-token-harbor"));

    // Question sheet opens with the highlighted word
    expect(getByText('"harbor"')).toBeTruthy();

    // Submit → short answer returns (dev fixture), keeping the user in flow
    fireEvent.press(getByText("질문하기"));
    expect(await findByText(/dev fixture/)).toBeTruthy();
    expect(getByText("닫고 계속")).toBeTruthy();
  });

  it("invokes onClose from the close button", () => {
    const onClose = jest.fn();
    const { getByTestId } = renderScreen(onClose);
    fireEvent.press(getByTestId("ci-session-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
