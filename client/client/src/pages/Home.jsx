import React from 'react';

export function Home() {
  return (
    <section className="Section">
      <div className="Container">
        <h1>Welcome to SudoDuel</h1>
        <p>Build, test, and deploy faster with a modern React starter.</p>
        <div className="HeroActions">
          <a className="Button Primary" href="/about">Learn more</a>
          <a className="Button" href="/contact">Contact us</a>
        </div>
      </div>
    </section>
  );
}


