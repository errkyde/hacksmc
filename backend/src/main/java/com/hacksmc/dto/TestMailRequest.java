package com.hacksmc.dto;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
public record TestMailRequest(@NotBlank @Email String to) {}
