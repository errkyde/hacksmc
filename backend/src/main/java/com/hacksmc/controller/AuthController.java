package com.hacksmc.controller;

import com.hacksmc.dto.ChangePasswordRequest;
import com.hacksmc.dto.LoginRequest;
import com.hacksmc.dto.LoginResponse;
import com.hacksmc.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @PostMapping("/change-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(Principal principal,
                               @Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(principal.getName(), request);
    }
}
