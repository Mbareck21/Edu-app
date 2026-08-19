/** What every item component gets from the runner, on top of its item. */
export type ItemControlProps = {
  /** The feedback sheet is up — freeze the controls. */
  locked: boolean;
  /** Mark the right answer on screen. */
  revealed: boolean;
  /** What the kid picked or typed, if anything. */
  chosen: string | null;
  /** One letter off on a typed answer: one more try. */
  almost: boolean;
  onAnswer: (given: string) => void;
};
