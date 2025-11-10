import React from 'react';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="Footer">
      <div className="Container FooterInner">
        <p>© {year} SudoDuel. All rights reserved.</p>
        <a href="https://react.dev" target="_blank" rel="noreferrer" className="FooterLink">Built with React</a>
      </div>
    </footer>
  );
}


