# InputEnglish Implementation Workflow

This workflow outlines the steps to build the InputEnglish web application based on the Figma design and extracted tokens.

## Phase 1: Foundation & Design System

1.  **Configure Tailwind CSS**: Update `tailwind.config.ts` to include the custom colors, fonts, and spacing from `design-system.json`.
2.  **Global Styles**: Update `globals.css` to set the base background color (`sys.color.background`) and default font.
3.  **Font Setup**: Ensure `Pretendard` and `Open Sans` are available (via `next/font` or CDN).

## Phase 2: Core Components

Implement these reusable components first.

1.  **Button**: Variants for Primary (`sys.color.primary`), Secondary, Ghost, and Social Login (Kakao/Naver).
2.  **Input**: Standard text input with focus states (`sys.color.primary` border).
3.  **Card**: Base card component with `sys.color.surface` background and `sys.shape.corner-large` radius.
4.  **Badge/Tag**: For labels like "Listening & Speaking".
5.  **Avatar**: For user profile images.

## Phase 3: Authentication (Sign Up)

**Target Page**: `/signup` (or root if strictly following flow)

1.  **Layout**: Centered card layout on `sys.color.background`.
2.  **Form**: "Create Account" header, Social Login buttons, Email/Password inputs (if applicable, though design shows social mostly).
3.  **Interactions**: Hover states for buttons.

## Phase 4: Home (Dashboard)

**Target Page**: `/home`

1.  **Top Navigation**: Logo, User Profile/Logout.
2.  **Empty State**: "No learning record" view with a call-to-action card.
3.  **Data State**: "Recent Sessions" list and "Recommended Videos" grid.
4.  **Video Card Component**: Thumbnail with duration overlay, Title, Channel info.

## Phase 5: Session Player (Listening)

**Target Page**: `/session/[id]`

1.  **Video Player**: Custom player controls (Play/Pause, Progress Bar, Volume).
    - **Hover State**: Show controls on hover.
    - **Menu State**: Playback speed options.
2.  **Session Header**: Title, Progress tracking.
3.  **Controls**: "Next Step" button to proceed to Script Listening.

## Phase 6: Script Listening (Interactive)

**Target Page**: `/session/[id]/script`

1.  **Script Layout**: Split view or centered list of sentences.
2.  **Sentence Component**:
    - **Default**: Text display.
    - **Active/Hover**: Highlight style.
    - **Action Popover**: "Why is this hard?" selection, "Add Comment" tooltip on text selection.
3.  **Analysis Panel**: Area to show AI analysis results.

## Phase 7: Shadowing Mode

**Target Page**: `/session/[id]/shadowing`

1.  **Mode Selector**: "Sentence", "Paragraph", "Full" toggle chips.
2.  **Shadowing Item**: Accordion-style expansion.
    - **Collapsed**: Text preview.
    - **Expanded**: Original Audio Player + User Recorder.
3.  **Recorder**: Mic button, Waveform visualization (if possible), Playback user audio.

## Implementation Order

1.  Foundation (Phase 1)
2.  Core Components (Phase 2)
3.  Home Page (Phase 4) - Good starting point for structure.
4.  Session Player (Phase 5)
5.  Script Listening (Phase 6)
6.  Shadowing Mode (Phase 7)
7.  Sign Up (Phase 3) - Can be done anytime, but Home is more core to the "app" experience.
