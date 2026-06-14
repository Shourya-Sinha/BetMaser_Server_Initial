import { validationResult } from 'express-validator';
import ApiResponse from '../Utils/responseHandler.js';

class ValidationMiddleware {
  /**
   * Check validation results
   */
  static validate(req, res, next) {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      const formattedErrors = errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }));

      return res.status(422).json(
        ApiResponse.validationError(formattedErrors, 'Validation failed')
      );
    }
    
    next();
  }

  /**
   * Sanitize request body
   */
  static sanitize(req, res, next) {
    // Remove any MongoDB operators
    if (req.body) {
      Object.keys(req.body).forEach(key => {
        if (key.startsWith('$')) {
          delete req.body[key];
        }
        // Trim strings
        if (typeof req.body[key] === 'string') {
          req.body[key] = req.body[key].trim();
        }
      });
    }
    next();
  }

  /**
   * Validate MongoDB ObjectId
   */
  static isValidObjectId(paramName) {
    return (req, res, next) => {
      const mongoose = require('mongoose');
      const id = req.params[paramName] || req.body[paramName];
      
      if (id && !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json(
          ApiResponse.badRequest(`Invalid ${paramName}`)
        );
      }
      
      next();
    };
  }
}

export default ValidationMiddleware;