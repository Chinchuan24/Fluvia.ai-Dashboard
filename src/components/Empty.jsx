/**
 * Empty state. Every panel explains what to add rather than showing a blank
 * box — an empty dashboard on first run should read as "nothing here yet,
 * here is how to change that", not as a failure.
 */
export default function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}
