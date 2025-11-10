import React from 'react';
import { Link, NavLink } from 'react-router-dom';

export function Navbar() {
  return (
    <header className="Navbar">
      <div className="Container NavbarInner">
        <Link to="/" className="Brand">SudoDuel</Link>
        <nav className="Nav">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'NavLink Active' : 'NavLink'}>Home</NavLink>
          <NavLink to="/about" className={({ isActive }) => isActive ? 'NavLink Active' : 'NavLink'}>About</NavLink>
          <NavLink to="/contact" className={({ isActive }) => isActive ? 'NavLink Active' : 'NavLink'}>Contact</NavLink>
        </nav>
      </div>
    </header>
  );
}


