import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import App from '../App';

describe('Navigation and App Hierarchy', () => {
  it('renders without crashing and displays all 4 bottom tabs', async () => {
    render(<App />);

    // Bottom tab bar labels
    expect(await screen.findByText('Learn')).toBeTruthy();
    expect(await screen.findByText('History')).toBeTruthy();
    expect(await screen.findByText('Word Bank')).toBeTruthy();
    expect(await screen.findByText('Settings')).toBeTruthy();
  });

  it('initially displays LearnScreen with daily lesson topics and JLPT selector', async () => {
    render(<App />);

    // Learn Screen elements
    expect(await screen.findByText('AI Japanese Teacher')).toBeTruthy();
    expect(await screen.findByText('Proficiency Level')).toBeTruthy();
    expect(await screen.findByText('Lesson Topic')).toBeTruthy();
    expect(await screen.findByText('Generate Daily Lesson')).toBeTruthy();
  });

  it('navigates to History tab when tapped', async () => {
    render(<App />);

    const historyTab = await screen.findByText('History');
    fireEvent.press(historyTab);

    await waitFor(() => {
      expect(screen.getByText('Lesson History')).toBeTruthy();
      expect(screen.getByText('Recent lessons (Auto-saved FIFO) · Star to pin')).toBeTruthy();
    });
  });

  it('navigates to Word Bank tab when tapped', async () => {
    render(<App />);

    const wordBankTab = await screen.findByText('Word Bank');
    fireEvent.press(wordBankTab);

    await waitFor(() => {
      expect(screen.getByText('Cumulative vocabulary from daily lessons')).toBeTruthy();
    });
  });

  it('navigates to Settings tab when tapped', async () => {
    render(<App />);

    const settingsTab = await screen.findByText('Settings');
    fireEvent.press(settingsTab);

    await waitFor(() => {
      expect(screen.getByText('Google Gemini API Key')).toBeTruthy();
      expect(screen.getByText('Japanese Speech Synthesis')).toBeTruthy();
    });
  });
});
