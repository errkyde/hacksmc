package com.hacksmc;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class PfsmcApplication {
    public static void main(String[] args) {
        SpringApplication.run(PfsmcApplication.class, args);
    }
}
