package com.hacksmc.exception;

import com.hacksmc.entity.ErrorLog;
import com.hacksmc.exception.MaintenanceException;
import com.hacksmc.repository.ErrorLogRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.NoSuchElementException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private final ErrorLogRepository errorLogRepository;

    public GlobalExceptionHandler(ErrorLogRepository errorLogRepository) {
        this.errorLogRepository = errorLogRepository;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidation(MethodArgumentNotValidException ex) {
        String detail = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> e.getField() + ": " + e.getDefaultMessage())
                .reduce((a, b) -> a + "; " + b)
                .orElse("Validation failed");
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, detail);
    }

    @ExceptionHandler(PolicyViolationException.class)
    public ProblemDetail handlePolicyViolation(PolicyViolationException ex, HttpServletRequest req) {
        var pd = ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, ex.getMessage());
        persist(req, HttpStatus.FORBIDDEN.value(), ex);
        return pd;
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ProblemDetail handleAccessDenied(AccessDeniedException ex, HttpServletRequest req) {
        var pd = ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, ex.getMessage());
        persist(req, HttpStatus.FORBIDDEN.value(), ex);
        return pd;
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ProblemDetail handleBadCredentials(BadCredentialsException ex) {
        // skip — login failures are too noisy
        return ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, ex.getMessage());
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ProblemDetail handleNotFound(NoSuchElementException ex, HttpServletRequest req) {
        var pd = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
        persist(req, HttpStatus.NOT_FOUND.value(), ex);
        return pd;
    }

    @ExceptionHandler(PfSenseException.class)
    public ProblemDetail handlePfSense(PfSenseException ex, HttpServletRequest req) {
        var pd = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_GATEWAY,
                "pfSense nicht erreichbar: " + ex.getMessage());
        persist(req, HttpStatus.BAD_GATEWAY.value(), ex);
        return pd;
    }

    @ExceptionHandler(MaintenanceException.class)
    public ProblemDetail handleMaintenance(MaintenanceException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE, ex.getMessage());
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ProblemDetail handleResponseStatus(ResponseStatusException ex, HttpServletRequest req) {
        var pd = ProblemDetail.forStatusAndDetail(
                HttpStatus.valueOf(ex.getStatusCode().value()), ex.getReason());
        persist(req, ex.getStatusCode().value(), ex);
        return pd;
    }

    @ExceptionHandler(RuntimeException.class)
    public ProblemDetail handleRuntime(RuntimeException ex, HttpServletRequest req) {
        var pd = ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR,
                "Internal error: " + ex.getMessage());
        persist(req, HttpStatus.INTERNAL_SERVER_ERROR.value(), ex);
        return pd;
    }

    private void persist(HttpServletRequest req, int status, Exception ex) {
        try {
            String actor = null;
            var auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
                actor = auth.getName();
            }

            var entry = new ErrorLog();
            entry.setActor(actor);
            entry.setMethod(req.getMethod());
            entry.setPath(req.getRequestURI());
            entry.setHttpStatus(status);
            entry.setErrorType(ex.getClass().getSimpleName());
            entry.setMessage(ex.getMessage());
            errorLogRepository.save(entry);
        } catch (Exception ignored) {
            // never let error logging break the response
        }
    }
}
