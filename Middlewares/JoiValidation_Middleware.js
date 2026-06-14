class JoiValidationMiddleware {
  static validate(schema) {
    return (req, res, next) => {
      const { error } = schema.validate(req.body, {
        abortEarly: false
      });

      if (error) {
        return res.status(422).json({
          success: false,
          errors: error.details.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }

      next();
    };
  }
}

export default JoiValidationMiddleware;