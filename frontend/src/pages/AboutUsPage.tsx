import React from 'react';

interface AboutUsPageProps {
  onBack: () => void;
}

export const AboutUsPage: React.FC<AboutUsPageProps> = ({ onBack }) => {
  return (
    <main className="app simple-screen about-screen">
      <button className="back-link" onClick={onBack}>
        ← Back to Main Menu
      </button>

      <div className="about-content-wrapper">
        <header className="about-header">
          <p className="eyebrow">ABOUT US</p>
          <h1 className="about-title">
            Our Journey — From an Idea to Least Count
          </h1>
          <div className="about-suit-accent">
            <span>♠</span>
            <span>♥</span>
            <span>♦</span>
            <span>♣</span>
          </div>
        </header>

        <article className="simple-card about-card">
          <p className="about-lead">
            Every great game begins with a simple idea.
          </p>

          <p>
            Least Count started with a love for playing cards and the fun of competing with friends. The idea was to take a familiar card-game experience and turn it into something that friends could enjoy together, wherever they were.
          </p>

          <p>
            What began as an idea gradually became a project. We worked on the rules, designed the interface, built the gameplay, and developed the multiplayer experience so players could create rooms and play together online.
          </p>

          <p>
            Building Least Count was also a journey of learning, experimenting, solving problems, and improving the game one step at a time. From working on the cards and scoring to making online rooms possible, every part of the project helped bring the original idea closer to reality.
          </p>

          <p>
            The goal is simple: make it easy for friends to get together, enjoy a game, challenge each other, and create memories—even when they are far apart.
          </p>

          <p>
            Least Count is more than just a card game project. It is an idea brought to life through curiosity, effort, and a passion for building something enjoyable.
          </p>

          <p>
            This is our journey, and there is more to come.
          </p>

          <div className="about-callout">
            <p className="about-callout-text">
              Shuffle the cards. Gather your friends. Let the game begin!
            </p>
          </div>
        </article>

        <div className="about-back-container">
          <button className="back-link" onClick={onBack}>
            ← Back to Main Menu
          </button>
        </div>
      </div>

      <div className="developer-credit">
        Developed by Saai NikhiL
      </div>
    </main>
  );
};
