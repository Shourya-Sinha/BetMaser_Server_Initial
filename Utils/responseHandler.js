class ApiResponse {
    constructor(status, message, data = null, code = 200) {
        this.success = status;
        this.code = code;
        this.message = message;
        this.data = data;
        this.timestamp = new Date().toISOString();
    }

    static success(data, message = 'Success', code = 200) {
        return {
            success: true,
            code,
            message,
            data,
            timestamp: new Date().toISOString()
        };
    }

    static created(data, message = 'Created successfully', code = 201) {
        return {
            success: true,
            code,
            message,
            data,
            timestamp: new Date().toISOString()
        };
    }

    static error(message = 'Internal Server Error', code = 500, errors = null) {
        return {
            success: false,
            code,
            message,
            errors,
            timestamp: new Date().toISOString()
        };
    }

    static notFound(message = 'Resource not found', code = 404) {
        return {
            success: false,
            code,
            message,
            data: null,
            timestamp: new Date().toISOString()
        };
    }

    static badRequest(message = 'Bad request', errors = null, code = 400) {
        return {
            success: false,
            code,
            message,
            errors,
            timestamp: new Date().toISOString()
        };
    }

    static unauthorized(message = 'Unauthorized access', code = 401) {
        return {
            success: false,
            code,
            message,
            data: null,
            timestamp: new Date().toISOString()
        };
    }

    static forbidden(message = 'Forbidden access', code = 403) {
        return {
            success: false,
            code,
            message,
            data: null,
            timestamp: new Date().toISOString()
        };
    }

    static validationError(errors, message = 'Validation failed', code = 422) {
        return {
            success: false,
            code,
            message,
            errors,
            timestamp: new Date().toISOString()
        };
    }

    static tooMany(message = 'Too many requests', code = 429) {
        return {
            success: false,
            code,
            message,
            data: null,
            timestamp: new Date().toISOString()
        };
    }
}

export default ApiResponse;