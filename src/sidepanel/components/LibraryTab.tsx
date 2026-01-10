interface LibraryTabProps {
  active: boolean;
}

export function LibraryTab(props: LibraryTabProps) {
  const { active } = props;

  return (
    <section id="tab-library" className={`tab-content ${active ? 'active' : ''}`}>
      <h2>Library</h2>
      <p className="helper-text">Your notebooks and saved content.</p>
      <div id="notebooks-list" className="notebooks-list"></div>
    </section>
  );
}
