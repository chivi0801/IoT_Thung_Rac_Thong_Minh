package com.smartbin.backend_smart_bin;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "com.smartbin")
public class BackendSmartBinApplication {

	public static void main(String[] args) {
		SpringApplication.run(BackendSmartBinApplication.class, args);
	}

}
