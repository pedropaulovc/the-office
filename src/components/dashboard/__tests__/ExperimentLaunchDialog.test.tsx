import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExperimentLaunchDialog } from '../ExperimentLaunchDialog';

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  onLaunch: vi.fn().mockResolvedValue(undefined),
};

describe('ExperimentLaunchDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when open=false', () => {
    render(<ExperimentLaunchDialog {...defaultProps} open={false} />);

    expect(screen.queryByTestId('launch-dialog')).toBeNull();
  });

  it('renders form fields when open=true', () => {
    render(<ExperimentLaunchDialog {...defaultProps} />);

    expect(screen.getByTestId('launch-dialog')).toBeDefined();
    expect(screen.getByText('New Experiment')).toBeDefined();
    expect(screen.getByLabelText('Seed')).toBeDefined();
    expect(screen.getByText('Scale: 0.10')).toBeDefined();
    expect(screen.getByText('Template')).toBeDefined();
    expect(screen.getByText('LLM')).toBeDefined();
    expect(screen.getByText('Dry Run')).toBeDefined();
  });

  it('scenario dropdown shows 4 scenarios', () => {
    render(<ExperimentLaunchDialog {...defaultProps} />);

    const select = screen.getByTestId('scenario-select');
    const options = select.querySelectorAll('option');
    expect(options).toHaveLength(4);
    expect(options[0]?.textContent).toBe('Brainstorming (Average)');
    expect(options[1]?.textContent).toBe('Brainstorming (Difficult Full)');
    expect(options[2]?.textContent).toBe('Brainstorming (Difficult Variety)');
    expect(options[3]?.textContent).toBe('Debate (Controversial)');
  });

  it('scale slider defaults to 0.1', () => {
    render(<ExperimentLaunchDialog {...defaultProps} />);

    const slider = screen.getByLabelText(/Scale/);
    expect((slider as HTMLInputElement).value).toBe('0.1');
  });

  it('cancel button calls onClose', () => {
    const onClose = vi.fn();
    render(<ExperimentLaunchDialog {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('X button calls onClose', () => {
    const onClose = vi.fn();
    render(<ExperimentLaunchDialog {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('cancel-btn'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('launch button calls onLaunch with correct default data', async () => {
    const onLaunch = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<ExperimentLaunchDialog {...defaultProps} onLaunch={onLaunch} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('launch-btn'));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce();
    });

    expect(onLaunch).toHaveBeenCalledWith({
      scenarioId: 'brainstorming-average',
      seed: 42,
      scale: 0.1,
      mode: 'template',
      populationSource: 'generated',
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('population source radio buttons toggle correctly', () => {
    render(<ExperimentLaunchDialog {...defaultProps} />);

    const existingRadio = screen.getByLabelText('Use Office Characters');
    fireEvent.click(existingRadio);

    // Scenario select should be hidden when using existing characters
    expect(screen.queryByTestId('scenario-select')).toBeNull();
  });
});
