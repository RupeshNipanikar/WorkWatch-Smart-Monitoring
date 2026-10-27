import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getAvatarColor(name: string): string {
  const colors = [
    'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
    'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
  ];
  if (!name) return colors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function shouldGroupWithPrevious(currentMsg: any, prevMsg: any): boolean {
  if (!prevMsg) return false;
  const sameSender = (currentMsg.senderId || currentMsg.sender_id) === (prevMsg.senderId || prevMsg.sender_id);
  const currentTime = new Date(currentMsg.createdAt || currentMsg.created_at || currentMsg.timestamp).getTime();
  const prevTime = new Date(prevMsg.createdAt || prevMsg.created_at || prevMsg.timestamp).getTime();
  const timeDiff = (currentTime - prevTime) / 1000 / 60; // diff in minutes
  return sameSender && timeDiff < 5;
}

export function createTonePlayer(type: 'incoming' | 'outgoing') {
  let audioContext: AudioContext | null = null;
  let interval: any = null;

  const start = () => {
    if (audioContext) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      audioContext = new AudioContextClass();
      
      const playTone = () => {
        if (!audioContext) return;
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        if (type === 'incoming') {
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
          gainNode.gain.setValueAtTime(0, audioContext.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.1);
          gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
        } else {
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(660, audioContext.currentTime);
          gainNode.gain.setValueAtTime(0, audioContext.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.1);
          gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 1.0);
        }
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + (type === 'incoming' ? 0.5 : 1.0));
      };

      interval = setInterval(playTone, type === 'incoming' ? 1000 : 3000);
      playTone();
    } catch (e) {
      console.error("Failed to start audio context", e);
    }
  };

  const stop = () => {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
  };

  return { start, stop };
}
