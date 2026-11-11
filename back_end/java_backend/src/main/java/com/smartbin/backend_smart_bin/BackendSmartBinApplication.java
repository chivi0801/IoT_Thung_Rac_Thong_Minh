package com.smartbin.backend_smart_bin;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.persistence.autoconfigure.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication(scanBasePackages = "com.smartbin")
@EntityScan("com.smartbin.entity")
@EnableJpaRepositories("com.smartbin.repository")
public class BackendSmartBinApplication {

	public static void main(String[] args) {
		SpringApplication.run(BackendSmartBinApplication.class, args);
	}

}
