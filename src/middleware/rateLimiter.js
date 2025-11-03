import rateLimit from 'express-rate-limit';

export const globalLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 200, 
	message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true, 
	legacyHeaders: false, 
});

export const authLimiter = rateLimit({
	windowMs: 5 * 60 * 1000, // 5 minutes
	max: 10,
	message: 'Too many authentication attempts, please  try again after 5 minutes',
  standardHeaders: true,
	legacyHeaders: false,
});

export const actionLimiter = rateLimit({
	windowMs: 1 * 60 * 1000, // 1 minute
	max: 15, 
	message: 'You are performing too many actions, please try again in a minute.',
  standardHeaders: true,
	legacyHeaders: false,
});

export const adminActionLimiter = rateLimit({
	windowMs: 1 * 60 * 1000, // 1 minute
	max: 5, 
	message: 'Too many admin actions, please try again later.',
  standardHeaders: true,
	legacyHeaders: false,
});