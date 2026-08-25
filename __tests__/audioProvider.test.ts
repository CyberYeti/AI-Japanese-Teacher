import * as Speech from 'expo-speech';
import {
  NativeExpoSpeechProvider,
  defaultAudioProvider,
} from '../src/services/audioProvider';

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn().mockResolvedValue(undefined),
  resume: jest.fn().mockResolvedValue(undefined),
  isSpeakingAsync: jest.fn().mockResolvedValue(false),
  getAvailableVoicesAsync: jest.fn().mockResolvedValue([
    { identifier: 'com.apple.speech.synthesis.voice.kyoko', name: 'Kyoko', language: 'ja-JP' },
    { identifier: 'com.apple.speech.synthesis.voice.samantha', name: 'Samantha', language: 'en-US' },
  ]),
}));

describe('NativeExpoSpeechProvider', () => {
  let provider: NativeExpoSpeechProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new NativeExpoSpeechProvider();
  });

  describe('provider identity', () => {
    it('should have id "expo-speech" and human-readable name', () => {
      expect(provider.id).toBe('expo-speech');
      expect(provider.name).toBe('Native Device Speech (Expo Speech)');
    });

    it('should provide default singleton audio provider instance', () => {
      expect(defaultAudioProvider).toBeInstanceOf(NativeExpoSpeechProvider);
    });
  });

  describe('playSentence', () => {
    it('should call Speech.speak with text and ja-JP language', async () => {
      const onSentenceStart = jest.fn();
      const onSentenceEnd = jest.fn();
      const onFinished = jest.fn();

      await provider.playSentence('こんにちは', 0, {
        rate: 0.85,
        onSentenceStart,
        onSentenceEnd,
        onFinished,
      });

      expect(Speech.speak).toHaveBeenCalledWith('こんにちは', expect.objectContaining({
        language: 'ja-JP',
        rate: 0.85,
      }));

      // Simulate Speech callbacks
      const speakOptions = (Speech.speak as jest.Mock).mock.calls[0][1];
      speakOptions.onStart();
      expect(onSentenceStart).toHaveBeenCalledWith(0);

      speakOptions.onDone();
      expect(onSentenceEnd).toHaveBeenCalledWith(0);
      expect(onFinished).toHaveBeenCalled();
    });

    it('should pass voiceId when specified in options', async () => {
      await provider.playSentence('ありがとう', 1, {
        voiceId: 'com.apple.speech.synthesis.voice.kyoko',
      });

      expect(Speech.speak).toHaveBeenCalledWith('ありがとう', expect.objectContaining({
        voice: 'com.apple.speech.synthesis.voice.kyoko',
      }));
    });

    it('should handle Speech.onError callback', async () => {
      const onError = jest.fn();
      await provider.playSentence('エラーテスト', 0, { onError });

      const speakOptions = (Speech.speak as jest.Mock).mock.calls[0][1];
      const testError = new Error('TTS hardware failure');
      speakOptions.onError(testError);

      expect(onError).toHaveBeenCalledWith(testError);
    });
  });

  describe('playPassage', () => {
    const passage = [
      'いらっしゃいませ。',
      'ホットコーヒーをお願いします。',
      'かしこまりました。',
    ];

    it('should play sentences sequentially from startIndex', async () => {
      const onSentenceStart = jest.fn();
      const onSentenceEnd = jest.fn();
      const onFinished = jest.fn();

      await provider.playPassage(passage, 0, {
        rate: 1.0,
        onSentenceStart,
        onSentenceEnd,
        onFinished,
      });

      expect(Speech.speak).toHaveBeenCalledTimes(1);
      expect(Speech.speak).toHaveBeenLastCalledWith('いらっしゃいませ。', expect.anything());

      // Simulate first sentence onDone -> triggers next
      let currentOptions = (Speech.speak as jest.Mock).mock.calls[0][1];
      currentOptions.onStart();
      expect(onSentenceStart).toHaveBeenCalledWith(0);

      currentOptions.onDone();
      expect(onSentenceEnd).toHaveBeenCalledWith(0);
      expect(Speech.speak).toHaveBeenCalledTimes(2);
      expect(Speech.speak).toHaveBeenLastCalledWith('ホットコーヒーをお願いします。', expect.anything());

      // Simulate second sentence onDone
      currentOptions = (Speech.speak as jest.Mock).mock.calls[1][1];
      currentOptions.onStart();
      expect(onSentenceStart).toHaveBeenCalledWith(1);

      currentOptions.onDone();
      expect(onSentenceEnd).toHaveBeenCalledWith(1);
      expect(Speech.speak).toHaveBeenCalledTimes(3);
      expect(Speech.speak).toHaveBeenLastCalledWith('かしこまりました。', expect.anything());

      // Simulate third sentence onDone -> completes passage
      currentOptions = (Speech.speak as jest.Mock).mock.calls[2][1];
      currentOptions.onStart();
      expect(onSentenceStart).toHaveBeenCalledWith(2);

      currentOptions.onDone();
      expect(onSentenceEnd).toHaveBeenCalledWith(2);
      expect(onFinished).toHaveBeenCalled();
    });

    it('should start at specified startIndex', async () => {
      await provider.playPassage(passage, 1);
      expect(Speech.speak).toHaveBeenCalledWith('ホットコーヒーをお願いします。', expect.anything());
    });

    it('should stop passage playback when stop() is called', async () => {
      const onFinished = jest.fn();

      await provider.playPassage(passage, 0, { onFinished });
      expect(Speech.speak).toHaveBeenCalledTimes(1);

      // Call stop before sentence completes
      await provider.stop();
      expect(Speech.stop).toHaveBeenCalled();

      // Triggering onDone after stop should not advance to next sentence
      const currentOptions = (Speech.speak as jest.Mock).mock.calls[0][1];
      currentOptions.onDone();

      expect(Speech.speak).toHaveBeenCalledTimes(1);
      expect(onFinished).not.toHaveBeenCalled();
    });
  });

  describe('voice query & controls', () => {
    it('should get available Japanese voices', async () => {
      const japaneseVoices = await provider.getJapaneseVoices();
      expect(japaneseVoices).toHaveLength(1);
      expect(japaneseVoices[0].identifier).toBe('com.apple.speech.synthesis.voice.kyoko');
    });

    it('should delegate pause, resume, isSpeaking to Speech module', async () => {
      await provider.pause();
      expect(Speech.pause).toHaveBeenCalled();

      await provider.resume();
      expect(Speech.resume).toHaveBeenCalled();

      await provider.isSpeaking();
      expect(Speech.isSpeakingAsync).toHaveBeenCalled();
    });
  });
});
