import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { createMatch, getGame, listGames, type GameAction } from '../engine';
import { GameSurface } from '../ui/GameSurface';

// Importing App registers all games + views as a side effect.

describe('App gallery', () => {
  it('lists every registered game on the home page', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByText('Crown Rush')).toBeInTheDocument();
    expect(screen.getByText('Lantern Hunt')).toBeInTheDocument();
    expect(screen.getByText('Relic Run')).toBeInTheDocument();
  });

  it('shows the setup screen for a game', () => {
    render(
      <MemoryRouter initialEntries={['/setup/crown-rush']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByText('Start game')).toBeInTheDocument();
  });
});

describe('Game views render without crashing', () => {
  const players = [
    { id: 'p0', name: 'Ann' },
    { id: 'p1', name: 'Bo' },
  ];
  for (const def of listGames()) {
    it(`renders the ${def.name} surface`, () => {
      const state = createMatch(getGame(def.id)!, { seed: 's', players });
      render(
        <MemoryRouter>
          <GameSurface state={state} dispatch={(_a: GameAction) => {}} controlSeat={null} />
        </MemoryRouter>,
      );
      // The turn banner (with its unique "Turn 1" chip) is always present.
      expect(screen.getByText('Turn 1')).toBeInTheDocument();
    });
  }
});
