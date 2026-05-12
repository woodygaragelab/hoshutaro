import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const useAuthMock = jest.fn();
const useLLMSettingsMock = jest.fn();

jest.mock('../../../../hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}));

jest.mock('../../../../hooks/useLLMSettings', () => ({
  useLLMSettings: () => useLLMSettingsMock(),
}));

import { CloudLLMSettingsSection } from '../CloudLLMSettingsSection';

const SIGNED_IN_USER = {
  userId: 'u-1',
  username: 'alice@example.com',
  email: 'alice@example.com',
};

function defaultHookReturn(overrides: Record<string, unknown> = {}) {
  const updateAsync = jest.fn().mockResolvedValue(undefined);
  return {
    updateAsync,
    settings: undefined,
    isLoading: false,
    isFetching: false,
    error: null,
    update: jest.fn(),
    isUpdating: false,
    updateError: null,
    DEFAULTS: {
      preferredModel: null,
      fallbackModels: [],
      mtpEnabled: false,
      customApiKeys: null,
    },
    ...overrides,
  };
}

describe('CloudLLMSettingsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthMock.mockReturnValue({ user: SIGNED_IN_USER });
  });

  it('renders nothing when no user is signed in', () => {
    useAuthMock.mockReturnValue({ user: null });
    useLLMSettingsMock.mockReturnValue(defaultHookReturn());
    const { container } = render(<CloudLLMSettingsSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a spinner while loading', () => {
    useLLMSettingsMock.mockReturnValue(
      defaultHookReturn({ isLoading: true }),
    );
    render(<CloudLLMSettingsSection />);
    expect(screen.getByTestId('cloud-llm-loading')).toBeInTheDocument();
  });

  it('pre-fills form with normalized settings from the hook', async () => {
    useLLMSettingsMock.mockReturnValue(
      defaultHookReturn({
        settings: {
          preferredModel: 'cloud_claude_3_5_sonnet',
          fallbackModels: [],
          mtpEnabled: true,
          customApiKeys: null,
        },
      }),
    );
    render(<CloudLLMSettingsSection />);
    await waitFor(() =>
      expect(screen.getByTestId('cloud-llm-preferred-model')).toHaveValue(
        'cloud_claude_3_5_sonnet',
      ),
    );
    expect(screen.getByLabelText(/MTP.*有効化/)).toBeChecked();
  });

  it('falls back to DEFAULTS when the cloud record does not exist yet', async () => {
    useLLMSettingsMock.mockReturnValue(defaultHookReturn({ settings: null }));
    render(<CloudLLMSettingsSection />);
    await waitFor(() =>
      expect(screen.getByTestId('cloud-llm-preferred-model')).toHaveValue(''),
    );
    expect(screen.getByLabelText(/MTP.*有効化/)).not.toBeChecked();
  });

  it('calls updateAsync with trimmed preferredModel and mtpEnabled on save', async () => {
    const updateAsync = jest.fn().mockResolvedValue(undefined);
    useLLMSettingsMock.mockReturnValue(
      defaultHookReturn({ settings: null, updateAsync }),
    );
    const user = userEvent.setup();
    render(<CloudLLMSettingsSection />);

    await waitFor(() =>
      expect(screen.getByTestId('cloud-llm-preferred-model')).toBeInTheDocument(),
    );
    await user.type(
      screen.getByTestId('cloud-llm-preferred-model'),
      '  cloud_claude_3_haiku  ',
    );
    await user.click(screen.getByLabelText(/MTP.*有効化/));
    await user.click(screen.getByRole('button', { name: 'クラウド設定を保存' }));

    await waitFor(() =>
      expect(updateAsync).toHaveBeenCalledWith({
        preferredModel: 'cloud_claude_3_haiku',
        mtpEnabled: true,
      }),
    );
    expect(
      await screen.findByText(/クラウド設定を保存しました/),
    ).toBeInTheDocument();
  });

  it('sends preferredModel=null when the field is left empty', async () => {
    const updateAsync = jest.fn().mockResolvedValue(undefined);
    useLLMSettingsMock.mockReturnValue(
      defaultHookReturn({ settings: null, updateAsync }),
    );
    const user = userEvent.setup();
    render(<CloudLLMSettingsSection />);
    await waitFor(() =>
      expect(screen.getByTestId('cloud-llm-preferred-model')).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'クラウド設定を保存' }));
    expect(updateAsync).toHaveBeenCalledWith({
      preferredModel: null,
      mtpEnabled: false,
    });
  });

  it('surfaces query.error via an alert', () => {
    useLLMSettingsMock.mockReturnValue(
      defaultHookReturn({
        settings: null,
        error: new Error('Unauthorized'),
      }),
    );
    render(<CloudLLMSettingsSection />);
    expect(screen.getByText('Unauthorized')).toBeInTheDocument();
  });

  it('surfaces updateError via an alert', () => {
    useLLMSettingsMock.mockReturnValue(
      defaultHookReturn({
        settings: null,
        updateError: new Error('Network down'),
      }),
    );
    render(<CloudLLMSettingsSection />);
    expect(screen.getByText('Network down')).toBeInTheDocument();
  });
});
