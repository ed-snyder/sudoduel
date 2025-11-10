import React from 'react';

export function Contact() {
  return (
    <section className="Section">
      <div className="Container">
        <h1>Contact</h1>
        <p>Have questions? Reach out and we’ll get back to you.</p>
        <form className="ContactForm" onSubmit={(e) => e.preventDefault()}>
          <label>
            Name
            <input type="text" placeholder="Your name" required />
          </label>
          <label>
            Email
            <input type="email" placeholder="you@example.com" required />
          </label>
          <label>
            Message
            <textarea rows="4" placeholder="How can we help?" required />
          </label>
          <button className="Button Primary" type="submit">Send</button>
        </form>
      </div>
    </section>
  );
}


