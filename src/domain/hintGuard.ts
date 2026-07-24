/**
 * Returns true only if a hint is safe to show — i.e. it does not reveal the
 * correct answer. A deterministic backstop to the prompt instruction "never give
 * away the answer": even if the model slips, a hint that literally contains the
 * correct answer's text is rejected.
 *
 * Fails closed: if there is no answer text to protect, the hint is treated as
 * unsafe rather than assumed fine.
 */
export function isHintSafe(hint: string, correctText: string): boolean {
  const answer = correctText.trim().toLowerCase();
  if (answer === '') return false;
  return !hint.toLowerCase().includes(answer);
}
