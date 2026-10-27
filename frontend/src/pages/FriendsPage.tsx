import React, { useState, useEffect } from 'react';

interface FriendsPageProps {
  initialRoomCode?: string;
  defaultName?: string;
  onCreateRoom: (name: string, players: number, rounds: number) => void;
  onJoinRoom: (name: string, roomCode: string) => void;
  onBack: () => void;
  notice?: string;
}

export const FriendsPage: React.FC<FriendsPageProps> = ({
  initialRoomCode = '',
  defaultName = '',
  onCreateRoom,
  onJoinRoom,
  onBack,
  notice,
}) => {
  const [createName, setCreateName] = useState(defaultName);
  const [joinName, setJoinName] = useState(defaultName);
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [playersInput, setPlayersInput] = useState('4');
  const [roundsInput, setRoundsInput] = useState('10');
  const [localNotice, setLocalNotice] = useState('');

  useEffect(() => {
    if (initialRoomCode) {
      setRoomCode(initialRoomCode);
    }
  }, [initialRoomCode]);

  useEffect(() => {
    if (defaultName) {
      setCreateName(prev => prev || defaultName);
      setJoinName(prev => prev || defaultName);
    }
  }, [defaultName]);

  const handleCreateSubmit = () => {
    setLocalNotice('');
    if (!createName.trim()) {
      setLocalNotice('Please enter your display name.');
      return;
    }
    const p = parseInt(playersInput, 10);
    if (isNaN(p) || p < 2) {
      setLocalNotice('At least 2 players are required.');
      return;
    }
    const r = parseInt(roundsInput, 10);
    if (isNaN(r) || r < 1) {
      setLocalNotice('At least 1 round is required.');
      return;
    }
    onCreateRoom(createName.trim(), p, r);
  };

  return (
    <main className="app simple-screen">
      <button className="back-link" onClick={onBack}>
        ← Back to Main Menu
      </button>

      <div className="friends-heading">
        <h2>Play with friends</h2>
      </div>

      <div className="room-grid">
        {/* Create Room Form */}
        <section className="simple-card">
          <h3>Create room</h3>

          <label htmlFor="create-room-display-name">
            Your Display Name
            <input
              id="create-room-display-name"
              name="create-room-display-name"
              type="text"
              placeholder="Enter your name"
              value={createName}
              onChange={e => setCreateName(e.target.value)}
            />
          </label>

          <label>
            Number of Players
            <div className="counter">
              <button
                type="button"
                onClick={() => {
                  const val = parseInt(playersInput, 10) || 2;
                  setPlayersInput(String(Math.max(2, val - 1)));
                }}
              >
                −
              </button>
              <input
                type="number"
                min={2}
                value={playersInput}
                onChange={e => setPlayersInput(e.target.value)}
                className="counter-input"
              />
              <button
                type="button"
                onClick={() => {
                  const val = parseInt(playersInput, 10) || 2;
                  setPlayersInput(String(val + 1));
                }}
              >
                +
              </button>
            </div>
          </label>

          <label>
            Number of Rounds
            <div className="counter">
              <button
                type="button"
                onClick={() => {
                  const val = parseInt(roundsInput, 10) || 1;
                  setRoundsInput(String(Math.max(0, val - 1)));
                }}
              >
                −
              </button>
              <input
                type="number"
                min={0}
                value={roundsInput}
                onChange={e => setRoundsInput(e.target.value)}
                className="counter-input"
              />
              <button
                type="button"
                onClick={() => {
                  const val = parseInt(roundsInput, 10) || 0;
                  setRoundsInput(String(val + 1));
                }}
              >
                +
              </button>
            </div>
          </label>

          <button className="cta" onClick={handleCreateSubmit}>
            CREATE ROOM
          </button>
        </section>

        {/* Join Room Form */}
        <section className="simple-card">
          <h3>Join room</h3>

          <label htmlFor="join-room-display-name">
            Your Display Name
            <input
              id="join-room-display-name"
              name="join-room-display-name"
              type="text"
              placeholder="Enter your name"
              value={joinName}
              onChange={e => setJoinName(e.target.value)}
            />
          </label>

          <label htmlFor="join-room-code">
            Room ID / Code
            <input
              id="join-room-code"
              name="join-room-code"
              type="text"
              placeholder="e.g. LC-8F42K"
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase())}
            />
          </label>

          <button className="cta secondary" onClick={() => onJoinRoom(joinName, roomCode)}>
            JOIN ROOM
          </button>
        </section>
      </div>

      {(localNotice || notice) && <p className="status status-error">{localNotice || notice}</p>}
    </main>
  );
};
